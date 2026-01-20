import { NextRequest, NextResponse } from "next/server";
import {
  validateOrder,
  processOrder,
  formatAdminTelegramMessage,
  sendTelegramMessage,
  sendSellerNotifications,
  sendGroupNotification,
  OrderRequest,
} from "@/lib/order";
import { saveOrder, StoredOrder } from "@/lib/orders";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { validateSession } from "@/lib/auth";

// Rate limit config: 3 requests per 5 minutes per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 3,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

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
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // Check if buyer is logged in FIRST to determine validation rules
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Невірний формат даних" },
        { status: 400 }
      );
    }

    // Validate request (skip discord validation for logged-in buyers - we'll use session value)
    const validation = validateOrder(body, { skipDiscordValidation: isLoggedInBuyer });
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors[0]?.message || "Невірні дані",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Check environment variables
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

    // Process order and resolve to sellers
    // SECURITY: For logged-in buyers, ALWAYS use session discordId (ignore client-provided value)
    const rawOrder = body as OrderRequest;
    const order: OrderRequest = {
      ...rawOrder,
      discordNick: isLoggedInBuyer ? buyerDiscordId! : rawOrder.discordNick,
      // Ensure offer has a default value if not provided
      offer: rawOrder.offer || "",
    };
    const processedOrder = processOrder(order);

    // Save order to storage for seller dashboard access
    try {
      // Add buyer identity to the order if available
      const orderToSave = {
        ...processedOrder,
        buyerId,
        buyerDiscordId,
      };
      saveOrder(orderToSave as typeof processedOrder);
    } catch (saveError) {
      console.error("Failed to save order:", saveError);
      // Continue with notifications even if save fails
    }

    // Send group notification (if group chat ID is configured)
    let groupNotified = false;
    if (groupChatId) {
      const groupResult = await sendGroupNotification(botToken, groupChatId, processedOrder);
      groupNotified = groupResult.success;
      if (!groupResult.success) {
        console.error("Failed to send group notification:", groupResult.error);
      }
    }

    // Send admin notification (if admin chat ID is configured)
    if (adminChatId) {
      const userAgent = request.headers.get("user-agent") || undefined;
      const adminMessage = formatAdminTelegramMessage(processedOrder, userAgent);
      const adminResult = await sendTelegramMessage(botToken, adminChatId, adminMessage);

      if (!adminResult.success) {
        console.error("Failed to send admin notification:", adminResult.error);
      }
    }

    // Send notifications to relevant sellers
    const sellerNotificationResults = await sendSellerNotifications(botToken, processedOrder);

    // Log results (keep in English for debugging)
    console.log(
      `Order ${processedOrder.orderId}: Group notified=${groupNotified}, Admin notified=${!!adminChatId}, ` +
      `Sellers notified=${sellerNotificationResults.sent}, ` +
      `Failed=${sellerNotificationResults.failed}`
    );

    // Success response
    return NextResponse.json(
      {
        success: true,
        message: "Замовлення відправлено! Продавці отримали повідомлення.",
        orderId: processedOrder.orderId,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(rateLimitResult.resetAt),
        },
      }
    );
  } catch (error) {
    console.error("Order API error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Метод не дозволено" },
    { status: 405 }
  );
}
