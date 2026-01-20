import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import {
  getSellerById,
  getSellerBlueprintQuantity,
  updateSellerInventoryItem,
} from "@/lib/sellers";
import {
  canSellerReceiveOrders,
  ItemPrice,
  SellerOrderGroup,
  normalizeItemPrice
} from "@/lib/types";
import { getBlueprintById } from "@/lib/blueprints";
import { saveOrder, StoredOrder } from "@/lib/orders";
import {
  generateOrderId,
  sendTelegramMessage,
  formatSellerTelegramMessage,
  sendGroupNotification,
  formatAdminTelegramMessage,
  ProcessedOrder,
} from "@/lib/order";
import { withFileLock } from "@/lib/safe-file";
import path from "path";

// Rate limit config: 3 requests per 5 minutes per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 3,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

// Checkout item from client
interface CheckoutItem {
  id: string; // blueprintId
  name: string;
  quantity: number;
  sellerId: string;
  sellerDiscordId: string;
  priceSnapshot: ItemPrice;
  buyerOfferText?: string;
}

// Checkout request body
interface CheckoutRequest {
  discordNick: string;
  notes?: string;
  items: CheckoutItem[];
  website?: string; // Honeypot
}

// Validation result
interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: { field: string; message: string }[];
}

/**
 * Validate checkout request
 */
function validateCheckoutRequest(
  data: unknown,
  isLoggedInBuyer: boolean
): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, error: "Невірний запит" };
  }

  const req = data as Record<string, unknown>;

  // Honeypot check
  if (req.website && typeof req.website === "string" && req.website.trim() !== "") {
    return { valid: false, error: "Запит відхилено" };
  }

  // Discord validation (skip for logged-in buyers)
  if (!isLoggedInBuyer) {
    if (!req.discordNick || typeof req.discordNick !== "string" || !req.discordNick.trim()) {
      errors.push({ field: "discordNick", message: "Discord нікнейм обов'язковий" });
    } else if (req.discordNick.length > 64) {
      errors.push({ field: "discordNick", message: "Discord нікнейм занадто довгий" });
    }
  }

  // Items validation
  if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
    errors.push({ field: "items", message: "Кошик порожній" });
  } else if (req.items.length > 50) {
    errors.push({ field: "items", message: "Занадто багато позицій (макс. 50)" });
  } else {
    for (let i = 0; i < req.items.length; i++) {
      const item = req.items[i] as Record<string, unknown>;

      if (!item || typeof item !== "object") {
        errors.push({ field: `items[${i}]`, message: "Невірна позиція" });
        continue;
      }

      if (!item.id || typeof item.id !== "string") {
        errors.push({ field: `items[${i}].id`, message: "Відсутній ID креслення" });
      }

      if (!item.sellerId || typeof item.sellerId !== "string") {
        errors.push({ field: `items[${i}].sellerId`, message: "Відсутній ID продавця" });
      }

      if (typeof item.quantity !== "number" || item.quantity < 1 || item.quantity > 999) {
        errors.push({ field: `items[${i}].quantity`, message: "Невірна кількість (1-999)" });
      }

      // Validate offer for negotiable items
      const priceSnapshot = item.priceSnapshot as ItemPrice | undefined;
      const isNegotiable = !priceSnapshot || priceSnapshot.type === "Договірна";

      if (isNegotiable) {
        if (!item.buyerOfferText || typeof item.buyerOfferText !== "string" || !item.buyerOfferText.trim()) {
          errors.push({
            field: `items[${i}].buyerOfferText`,
            message: `Для позиції "${item.name || item.id}" з договірною ціною обов'язково вкажіть пропозицію`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate stock availability for all items
 */
async function validateStock(
  items: CheckoutItem[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const item of items) {
    // Verify seller exists and is active
    const seller = getSellerById(item.sellerId);
    if (!seller) {
      errors.push(`Продавця "${item.sellerDiscordId}" не знайдено для "${item.name}"`);
      continue;
    }

    if (!canSellerReceiveOrders(seller)) {
      errors.push(`Продавець "${item.sellerDiscordId}" не може приймати замовлення`);
      continue;
    }

    // Verify seller discordId matches (security check - don't trust client)
    if (seller.discordId !== item.sellerDiscordId) {
      console.warn(`Discord ID mismatch for seller ${item.sellerId}: ${seller.discordId} vs ${item.sellerDiscordId}`);
      // Use the real one
      item.sellerDiscordId = seller.discordId;
    }

    // Verify blueprint exists
    const blueprint = getBlueprintById(item.id);
    if (!blueprint) {
      errors.push(`Креслення "${item.name}" не знайдено`);
      continue;
    }

    // Verify seller has enough stock
    const availableQty = getSellerBlueprintQuantity(item.sellerId, item.id);
    if (availableQty < item.quantity) {
      errors.push(
        `Недостатньо "${item.name}" у продавця "${seller.discordId}" (є: ${availableQty}, потрібно: ${item.quantity})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Group items by seller for order creation
 */
function groupItemsBySeller(items: CheckoutItem[]): Map<string, CheckoutItem[]> {
  const groups = new Map<string, CheckoutItem[]>();

  for (const item of items) {
    const existing = groups.get(item.sellerId) || [];
    groups.set(item.sellerId, [...existing, item]);
  }

  return groups;
}

/**
 * Create orders for each seller group
 */
async function createOrdersForSellers(
  itemGroups: Map<string, CheckoutItem[]>,
  buyerDiscordNick: string,
  notes: string | undefined,
  buyerId: string | undefined,
  buyerDiscordId: string | undefined
): Promise<{ orders: ProcessedOrder[]; storedOrders: StoredOrder[]; errors: string[] }> {
  const orders: ProcessedOrder[] = [];
  const storedOrders: StoredOrder[] = [];
  const errors: string[] = [];

  for (const [sellerId, items] of Array.from(itemGroups.entries())) {
    const seller = getSellerById(sellerId);
    if (!seller) {
      errors.push(`Продавця не знайдено: ${sellerId}`);
      continue;
    }

    // Build offer from individual item offers
    const itemOffers = items
      .filter((item) => item.buyerOfferText && item.buyerOfferText.trim())
      .map((item) => `${item.name}: ${item.buyerOfferText!.trim()}`);

    const combinedOffer = itemOffers.length > 0
      ? itemOffers.join("\n")
      : "Покупець погодився з цінами";

    // Create processed order
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();

    const sellerGroup: SellerOrderGroup = {
      sellerId: seller.id,
      sellerDiscordId: seller.discordId,
      sellerTelegramChatId: seller.telegramChatId,
      items: items.map((item) => ({
        blueprintId: item.id,
        blueprintName: item.name,
        requestedQty: item.quantity,
        available: true, // Already validated
        availableQty: getSellerBlueprintQuantity(sellerId, item.id),
        priceSnapshot: normalizeItemPrice(item.priceSnapshot),
      })),
    };

    const processedOrder: ProcessedOrder = {
      orderId,
      buyerDiscordNick,
      offer: combinedOffer,
      originalOffer: combinedOffer,
      notes,
      sellerGroups: [sellerGroup],
      isMultiSeller: false, // Each order is for a single seller
      sellerCount: 1,
      createdAt,
    };

    orders.push(processedOrder);

    // Save order to storage
    try {
      const orderToSave = {
        ...processedOrder,
        buyerId,
        buyerDiscordId,
      };
      const stored = saveOrder(orderToSave as typeof processedOrder);
      storedOrders.push(stored);
    } catch (saveError) {
      console.error(`Failed to save order ${orderId}:`, saveError);
      errors.push(`Не вдалося зберегти замовлення для ${seller.discordId}`);
    }
  }

  return { orders, storedOrders, errors };
}

/**
 * Deduct inventory for all items (should be called after order creation)
 * Uses file locking for atomicity
 */
async function deductInventory(items: CheckoutItem[]): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const DATA_DIR = path.join(process.cwd(), "data");
  const lockFile = path.join(DATA_DIR, "inventory-lock");

  // Use a global lock for inventory operations to prevent race conditions
  try {
    await withFileLock(lockFile, async () => {
      for (const item of items) {
        const currentQty = getSellerBlueprintQuantity(item.sellerId, item.id);

        // Double-check stock (another request might have depleted it)
        if (currentQty < item.quantity) {
          errors.push(
            `Недостатньо "${item.name}" (залишилось: ${currentQty}, потрібно: ${item.quantity})`
          );
          continue;
        }

        const newQty = currentQty - item.quantity;
        const updated = await updateSellerInventoryItem(item.sellerId, item.id, newQty);

        if (!updated) {
          errors.push(`Не вдалося оновити інвентар для "${item.name}"`);
        }
      }
    });
  } catch (lockError) {
    console.error("Inventory lock error:", lockError);
    errors.push("Не вдалося заблокувати інвентар для оновлення");
  }

  return { success: errors.length === 0, errors };
}

/**
 * Send notifications for all orders
 */
async function sendNotifications(
  orders: ProcessedOrder[],
  botToken: string,
  adminChatId: string | undefined,
  groupChatId: string | undefined,
  userAgent: string | undefined
): Promise<void> {
  for (const order of orders) {
    // Send seller notification
    for (const sellerGroup of order.sellerGroups) {
      if (sellerGroup.sellerTelegramChatId) {
        const message = formatSellerTelegramMessage(order, sellerGroup);
        const result = await sendTelegramMessage(botToken, sellerGroup.sellerTelegramChatId, message);
        if (!result.success) {
          console.error(`Failed to send notification to seller ${sellerGroup.sellerId}:`, result.error);
        }
      }
    }

    // Send admin notification
    if (adminChatId) {
      const adminMessage = formatAdminTelegramMessage(order, userAgent);
      await sendTelegramMessage(botToken, adminChatId, adminMessage);
    }

    // Send group notification
    if (groupChatId) {
      await sendGroupNotification(botToken, groupChatId, order);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request.headers);

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Забагато запитів. Спробуйте через ${rateLimitResult.retryAfter} секунд.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Check if buyer is logged in
    let buyerId: string | undefined;
    let buyerDiscordId: string | undefined;
    let isLoggedInBuyer = false;

    try {
      const session = await validateSession();
      if (session.authenticated && session.role === "buyer" && session.buyerId && session.discordId) {
        buyerId = session.buyerId;
        buyerDiscordId = session.discordId;
        isLoggedInBuyer = true;
      }
    } catch {
      // Session check failed, continue as guest
    }

    // Parse request body
    let body: CheckoutRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Невірний формат даних" },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateCheckoutRequest(body, isLoggedInBuyer);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || validation.errors?.[0]?.message || "Невірні дані",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Check environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

    if (!botToken) {
      console.error("Missing TELEGRAM_BOT_TOKEN");
      return NextResponse.json(
        { success: false, error: "Сервер не налаштовано для прийому замовлень" },
        { status: 500 }
      );
    }

    // Prepare items with corrected seller info
    const items: CheckoutItem[] = body.items.map((item) => ({
      ...item,
      priceSnapshot: normalizeItemPrice(item.priceSnapshot),
    }));

    // Validate stock
    const stockValidation = await validateStock(items);
    if (!stockValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: stockValidation.errors[0] || "Недостатньо товару",
          stockErrors: stockValidation.errors,
        },
        { status: 400 }
      );
    }

    // Deduct inventory FIRST (atomic operation with locking)
    const inventoryResult = await deductInventory(items);
    if (!inventoryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: inventoryResult.errors[0] || "Не вдалося оновити інвентар",
          inventoryErrors: inventoryResult.errors,
        },
        { status: 400 }
      );
    }

    // Group items by seller
    const itemGroups = groupItemsBySeller(items);

    // Use session discordId for logged-in buyers (security: don't trust client)
    const finalDiscordNick = isLoggedInBuyer ? buyerDiscordId! : body.discordNick.trim();

    // Create orders for each seller
    const { orders, storedOrders, errors: orderErrors } = await createOrdersForSellers(
      itemGroups,
      finalDiscordNick,
      body.notes?.trim(),
      buyerId,
      buyerDiscordId
    );

    if (orders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Не вдалося створити замовлення",
          errors: orderErrors,
        },
        { status: 500 }
      );
    }

    // Send notifications (async, don't wait for all)
    const userAgent = request.headers.get("user-agent") || undefined;
    sendNotifications(orders, botToken, adminChatId, groupChatId, userAgent).catch((error) => {
      console.error("Notification error:", error);
    });

    // Log results
    console.log(
      `Checkout: Created ${orders.length} orders for ${items.length} items, ` +
        `buyer: ${finalDiscordNick}, sellers: ${Array.from(itemGroups.keys()).join(", ")}`
    );

    // Success response
    return NextResponse.json(
      {
        success: true,
        message:
          orders.length > 1
            ? `Створено ${orders.length} замовлень для різних продавців!`
            : "Замовлення створено!",
        orderIds: orders.map((o) => o.orderId),
        orderCount: orders.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Checkout API error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Метод не дозволено" },
    { status: 405 }
  );
}
