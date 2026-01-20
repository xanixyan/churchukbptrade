import { NextRequest, NextResponse } from "next/server";
import { registerSeller, validateDiscordId, validatePassword } from "@/lib/sellers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

// Rate limit config for registration: 3 attempts per 15 minutes
const REGISTER_RATE_LIMIT = { maxRequests: 3, windowMs: 15 * 60 * 1000 };

/**
 * POST /api/seller/register - Seller Registration
 * Creates a new seller account with PENDING_VERIFICATION status
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request.headers);
    const rateLimitKey = `seller-register:${clientIP}`;
    const rateLimit = checkRateLimit(rateLimitKey, REGISTER_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Забагато спроб реєстрації. Спробуйте пізніше.",
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    const body = await request.json();
    const { discordId, password, confirmPassword } = body;

    // Validate Discord ID
    const discordValidation = validateDiscordId(discordId);
    if (!discordValidation.valid) {
      return NextResponse.json(
        { error: discordValidation.error },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Check password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Паролі не співпадають" },
        { status: 400 }
      );
    }

    // Register the seller
    const result = await registerSeller(discordId.trim(), password);

    if (!result.success || !result.seller) {
      return NextResponse.json(
        { error: result.error || "Помилка реєстрації" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Обліковий запис створено. Очікуйте підтвердження від адміністратора.",
      seller: {
        id: result.seller.id,
        discordId: result.seller.discordId,
        status: result.seller.status,
      },
    });
  } catch (error) {
    console.error("Seller registration error:", error);
    return NextResponse.json(
      { error: "Помилка реєстрації" },
      { status: 500 }
    );
  }
}
