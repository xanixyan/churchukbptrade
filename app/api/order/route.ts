import { NextRequest, NextResponse } from "next/server";
import {
  validateOrder,
  formatTelegramMessage,
  sendTelegramMessage,
  OrderRequest,
} from "@/lib/order";
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
        { success: false, error: "Невалідний JSON" },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateOrder(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors[0]?.message || "Невалідні дані",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Check environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID");
      return NextResponse.json(
        { success: false, error: "Сервер не налаштований для прийому замовлень" },
        { status: 500 }
      );
    }

    // Format and send Telegram message
    const order = body as OrderRequest;
    const userAgent = request.headers.get("user-agent") || undefined;
    const message = formatTelegramMessage(order, userAgent);

    const sendResult = await sendTelegramMessage(botToken, chatId, message);
    if (!sendResult.success) {
      console.error("Failed to send Telegram message:", sendResult.error);
      return NextResponse.json(
        { success: false, error: "Не вдалося відправити замовлення. Спробуйте пізніше." },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json(
      {
        success: true,
        message: "Замовлення відправлено! Я зв'яжуся з вами в Discord.",
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
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}
