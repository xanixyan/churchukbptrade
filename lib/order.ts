// Order types and validation
import crypto from "crypto";
import { resolveOrderToSellers, getActiveSellers, requiresMultipleSellers } from "./sellers";
import { getBlueprintById } from "./blueprints";
import { SellerOrderGroup } from "./types";

// Fixed message for multi-seller orders (Ukrainian)
export const MULTI_SELLER_OFFER_MESSAGE =
  "Це замовлення включає кількох продавців. Ціна/умови мають бути узгоджені в приватних повідомленнях (DM).";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface OrderRequest {
  discordNick: string;
  offer: string;
  notes?: string;
  items: OrderItem[];
  // Honeypot field - should be empty
  website?: string;
}

export interface OrderValidationError {
  field: string;
  message: string;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: OrderValidationError[];
}

// Processed order with seller resolution
export interface ProcessedOrder {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  originalOffer: string; // Original offer from buyer (before multi-seller override)
  notes?: string;
  sellerGroups: SellerOrderGroup[];
  isMultiSeller: boolean; // True if order REQUIRES multiple sellers (no single seller can fulfill all)
  sellerCount: number; // Number of unique sellers who have any of the items
  createdAt: string;
}

/**
 * Generate unique order ID
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validate order request (Ukrainian error messages)
 */
export function validateOrder(data: unknown): OrderValidationResult {
  const errors: OrderValidationError[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Невірний запит" }] };
  }

  const order = data as Record<string, unknown>;

  // Check honeypot (anti-bot)
  if (order.website && typeof order.website === "string" && order.website.trim() !== "") {
    return { valid: false, errors: [{ field: "spam", message: "Запит відхилено" }] };
  }

  // Discord nickname validation
  if (!order.discordNick || typeof order.discordNick !== "string") {
    errors.push({ field: "discordNick", message: "Discord нікнейм обов'язковий" });
  } else {
    const nick = order.discordNick.trim();
    if (nick.length === 0) {
      errors.push({ field: "discordNick", message: "Discord нікнейм обов'язковий" });
    } else if (nick.length > 64) {
      errors.push({ field: "discordNick", message: "Discord нікнейм занадто довгий (макс. 64 символи)" });
    }
  }

  // Offer validation (required)
  if (!order.offer || typeof order.offer !== "string") {
    errors.push({ field: "offer", message: "Вкажіть, що пропонуєте взамін" });
  } else {
    const offer = order.offer.trim();
    if (offer.length === 0) {
      errors.push({ field: "offer", message: "Вкажіть, що пропонуєте взамін" });
    } else if (offer.length > 500) {
      errors.push({ field: "offer", message: "Пропозиція занадто довга (макс. 500 символів)" });
    }
  }

  // Notes validation (optional)
  if (order.notes && typeof order.notes === "string" && order.notes.length > 500) {
    errors.push({ field: "notes", message: "Примітки занадто довгі (макс. 500 символів)" });
  }

  // Items validation
  if (!order.items || !Array.isArray(order.items)) {
    errors.push({ field: "items", message: "Оберіть хоча б одне креслення" });
  } else {
    if (order.items.length === 0) {
      errors.push({ field: "items", message: "Оберіть хоча б одне креслення" });
    } else if (order.items.length > 50) {
      errors.push({ field: "items", message: "Занадто багато позицій (макс. 50)" });
    } else {
      // Validate each item
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i] as Record<string, unknown>;
        if (!item || typeof item !== "object") {
          errors.push({ field: `items[${i}]`, message: "Невірна позиція" });
          continue;
        }
        if (!item.id || typeof item.id !== "string") {
          errors.push({ field: `items[${i}].id`, message: "Відсутній ID креслення" });
        }
        if (!item.name || typeof item.name !== "string") {
          errors.push({ field: `items[${i}].name`, message: "Відсутня назва креслення" });
        }
        if (typeof item.quantity !== "number" || item.quantity < 1 || item.quantity > 999) {
          errors.push({ field: `items[${i}].quantity`, message: "Невірна кількість (1-999)" });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Process order and resolve to sellers
 */
export function processOrder(order: OrderRequest): ProcessedOrder {
  const orderId = generateOrderId();
  const createdAt = new Date().toISOString();

  // Map items to include blueprint names from catalog
  const itemsWithNames = order.items.map((item) => {
    const blueprint = getBlueprintById(item.id);
    return {
      blueprintId: item.id,
      blueprintName: blueprint?.name || item.name,
      quantity: item.quantity,
    };
  });

  // Resolve which sellers have these blueprints
  const sellerGroups = resolveOrderToSellers(itemsWithNames);

  // Number of sellers who have any of the ordered items
  const sellerCount = sellerGroups.length;

  // Check if order REQUIRES multiple sellers to fulfill
  // This is true ONLY if no single seller can fulfill ALL items
  // Example: Single blueprint with multiple sellers -> isMultiSeller = false
  const itemsForCheck = order.items.map((item) => ({
    blueprintId: item.id,
    quantity: item.quantity,
  }));
  const isMultiSeller = requiresMultipleSellers(itemsForCheck);

  const originalOffer = order.offer.trim();

  // Only override offer when order actually REQUIRES multiple sellers
  const offer = isMultiSeller ? MULTI_SELLER_OFFER_MESSAGE : originalOffer;

  return {
    orderId,
    buyerDiscordNick: order.discordNick.trim(),
    offer,
    originalOffer,
    notes: order.notes?.trim(),
    sellerGroups,
    isMultiSeller,
    sellerCount,
    createdAt,
  };
}

/**
 * Format Telegram message for admin (overview of all orders)
 */
export function formatAdminTelegramMessage(
  processedOrder: ProcessedOrder,
  userAgent?: string
): string {
  const itemsList = processedOrder.sellerGroups
    .flatMap((group) =>
      group.items.map(
        (item) =>
          `  • ${item.blueprintName} ×${item.requestedQty} ${item.available ? "✓" : "✗"} (${group.sellerDiscordId})`
      )
    )
    .join("\n");

  const shortUA = userAgent ? userAgent.substring(0, 100) : "Unknown";

  let message = `🆕 <b>NEW ORDER</b>`;

  // Add multi-seller warning
  if (processedOrder.isMultiSeller) {
    message += ` ⚠️ <b>MULTI-SELLER</b>`;
  }

  message += `\n\n`;
  message += `📋 <b>Order ID:</b> ${processedOrder.orderId}\n`;
  message += `👤 <b>Discord:</b> ${escapeHtml(processedOrder.buyerDiscordNick)}\n`;

  // For multi-seller orders, show both original offer and the override message
  if (processedOrder.isMultiSeller) {
    message += `💬 <b>Offer (original):</b> ${escapeHtml(processedOrder.originalOffer)}\n`;
    message += `⚠️ <b>Offer (displayed):</b> ${escapeHtml(processedOrder.offer)}\n`;
  } else {
    message += `💬 <b>Offer:</b> ${escapeHtml(processedOrder.offer)}\n`;
  }

  if (processedOrder.notes) {
    message += `📝 <b>Notes:</b> ${escapeHtml(processedOrder.notes)}\n`;
  } else {
    message += `📝 <b>Notes:</b> немає\n`;
  }

  message += `\n📦 <b>Items:</b>\n${escapeHtml(itemsList)}\n`;
  message += `\n👥 <b>Sellers involved:</b> ${processedOrder.sellerCount}\n`;
  message += `🕐 ${processedOrder.createdAt}\n`;
  message += `🌐 ${escapeHtml(shortUA)}`;

  return message;
}

/**
 * Format Telegram message for a specific seller
 * Includes buyer Discord and notes for contact purposes
 */
export function formatSellerTelegramMessage(
  processedOrder: ProcessedOrder,
  sellerGroup: SellerOrderGroup
): string {
  const itemsList = sellerGroup.items
    .map((item) => {
      const status = item.available
        ? `✅ Є в наявності (${item.availableQty} шт.)`
        : `❌ Немає в наявності (${item.availableQty} шт.)`;
      return `  • ${item.blueprintName} ×${item.requestedQty}\n    ${status}`;
    })
    .join("\n\n");

  let message = `📦 <b>НОВЕ ЗАМОВЛЕННЯ</b>`;

  // Add multi-seller indicator
  if (processedOrder.isMultiSeller) {
    message += ` ⚠️ <b>МУЛЬТИ-ПРОДАВЕЦЬ</b>`;
  }

  message += `\n\n`;
  message += `📋 <b>Order ID:</b> ${processedOrder.orderId}\n`;
  message += `👤 <b>Discord покупця:</b> ${escapeHtml(processedOrder.buyerDiscordNick)}\n`;
  message += `💬 <b>Пропозиція:</b> ${escapeHtml(processedOrder.offer)}\n`;

  // Always show notes (with "немає" if empty)
  if (processedOrder.notes) {
    message += `📝 <b>Примітки:</b> ${escapeHtml(processedOrder.notes)}\n`;
  } else {
    message += `📝 <b>Примітки:</b> немає\n`;
  }

  message += `\n<b>Замовлені позиції:</b>\n\n${escapeHtml(itemsList)}\n\n`;

  const availableCount = sellerGroup.items.filter((i) => i.available).length;
  const totalCount = sellerGroup.items.length;
  message += `📊 <b>Підсумок:</b> ${availableCount}/${totalCount} позицій в наявності`;

  return message;
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format Telegram message for group notification
 * Structure:
 * 1. Buyer Information (Discord, Order ID)
 * 2. Blueprints with seller availability
 * 3. Buyer Offer
 */
export function formatGroupTelegramMessage(
  processedOrder: ProcessedOrder
): string {
  // Get all active sellers for availability lookup
  const activeSellers = getActiveSellers();

  // Build blueprint-to-sellers map
  // For each ordered blueprint, find all active sellers and their availability
  const blueprintAvailability: Map<
    string,
    {
      blueprintName: string;
      requestedQty: number;
      sellers: { discordId: string; availableQty: number }[];
    }
  > = new Map();

  // First, collect unique blueprints from the order
  for (const sellerGroup of processedOrder.sellerGroups) {
    for (const item of sellerGroup.items) {
      if (!blueprintAvailability.has(item.blueprintId)) {
        blueprintAvailability.set(item.blueprintId, {
          blueprintName: item.blueprintName,
          requestedQty: item.requestedQty,
          sellers: [],
        });
      }
    }
  }

  // Now check ALL active sellers for each blueprint
  blueprintAvailability.forEach((bpData, blueprintId) => {
    for (const seller of activeSellers) {
      const inventoryItem = seller.inventory.find(
        (i) => i.blueprintId === blueprintId
      );
      const availableQty = inventoryItem?.quantity || 0;

      // Include seller if they have any quantity (even 0 to show "not available")
      // Actually, we want to show sellers who have this blueprint or had it
      if (availableQty > 0) {
        bpData.sellers.push({
          discordId: seller.discordId,
          availableQty,
        });
      }
    }
  });

  // Section 1: Buyer Information
  let message = `🧑 <b>Buyer:</b>\n`;
  message += `Discord: ${escapeHtml(processedOrder.buyerDiscordNick)}\n`;
  message += `Order ID: ${processedOrder.orderId}\n`;

  // Section 2: Blueprints with Seller Availability
  message += `\n📦 <b>Blueprints:</b>\n`;

  blueprintAvailability.forEach((bpData) => {
    message += `- ${escapeHtml(bpData.blueprintName)} x${bpData.requestedQty}\n`;

    if (bpData.sellers.length === 0) {
      message += `  • No active sellers have this blueprint\n`;
    } else {
      for (const seller of bpData.sellers) {
        const availabilityText =
          seller.availableQty >= bpData.requestedQty
            ? `Available: ${seller.availableQty}`
            : seller.availableQty > 0
            ? `Available: ${seller.availableQty} (need ${bpData.requestedQty})`
            : `Not available`;
        message += `  • Seller: ${escapeHtml(seller.discordId)} — ${availabilityText}\n`;
      }
    }
  });

  // Section 3: Buyer Offer
  message += `\n💬 <b>Buyer Offer:</b>\n`;
  message += escapeHtml(processedOrder.offer);

  return message;
}

/**
 * Send order notification to Telegram group
 */
export async function sendGroupNotification(
  botToken: string,
  groupChatId: string,
  processedOrder: ProcessedOrder
): Promise<{ success: boolean; error?: string }> {
  const message = formatGroupTelegramMessage(processedOrder);

  try {
    const result = await sendTelegramMessage(botToken, groupChatId, message);

    if (!result.success) {
      console.error("Failed to send group notification:", result.error);
    }

    return result;
  } catch (error) {
    console.error("Group notification error:", error);
    return { success: false, error: "Failed to send group notification" };
  }
}

/**
 * Send message to Telegram
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Telegram API error:", errorData);
      return { success: false, error: "Failed to send message" };
    }

    return { success: true };
  } catch (error) {
    console.error("Telegram send error:", error);
    return { success: false, error: "Telegram connection error" };
  }
}

/**
 * Send order notifications to all relevant sellers
 */
export async function sendSellerNotifications(
  botToken: string,
  processedOrder: ProcessedOrder
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const sellerGroup of processedOrder.sellerGroups) {
    if (!sellerGroup.sellerTelegramChatId) {
      // Seller has no Telegram chat ID configured
      continue;
    }

    // Pass full order to include buyer Discord and notes
    const message = formatSellerTelegramMessage(processedOrder, sellerGroup);

    const result = await sendTelegramMessage(
      botToken,
      sellerGroup.sellerTelegramChatId,
      message
    );

    if (result.success) {
      sent++;
    } else {
      failed++;
      console.error(
        `Failed to send notification to seller ${sellerGroup.sellerId}:`,
        result.error
      );
    }
  }

  return { sent, failed };
}
