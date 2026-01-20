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
import { saveOrder } from "@/lib/orders";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

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

    // Validate request
    const validation = validateOrder(body);
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
    const order = body as OrderRequest;
    const processedOrder = processOrder(order);

    // Save order to storage for seller dashboard access
    try {
      saveOrder(processedOrder);
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
