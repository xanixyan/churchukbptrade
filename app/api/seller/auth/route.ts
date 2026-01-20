import { NextRequest, NextResponse } from "next/server";
import {
  authenticateSeller,
  createSellerSession,
  validateSellerSession,
  destroySession,
} from "@/lib/auth";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

// Rate limit config for login: 5 attempts per 15 minutes
const LOGIN_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 };

/**
 * POST /api/seller/auth - Seller Login
 * Authenticates seller by Discord ID and password
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request.headers);
    const rateLimitKey = `seller-login:${clientIP}`;
    const rateLimit = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Забагато спроб входу. Спробуйте пізніше.",
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
    const { discordId, password } = body;

    if (!discordId || typeof discordId !== "string") {
      return NextResponse.json(
        { error: "Discord ID обов'язковий" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Пароль обов'язковий" },
        { status: 400 }
      );
    }

    const trimmedDiscordId = discordId.trim();
    if (trimmedDiscordId.length === 0) {
      return NextResponse.json(
        { error: "Discord ID не може бути порожнім" },
        { status: 400 }
      );
    }

    // Authenticate seller with password
    const authResult = await authenticateSeller(trimmedDiscordId, password);

    if (!authResult.success || !authResult.seller) {
      return NextResponse.json(
        {
          error: authResult.error || "Помилка автентифікації",
          statusMessage: authResult.statusMessage,
        },
        { status: 401 }
      );
    }

    // Create session
    await createSellerSession(authResult.seller.id);

    return NextResponse.json({
      success: true,
      seller: {
        id: authResult.seller.id,
        discordId: authResult.seller.discordId,
        status: authResult.seller.status,
      },
    });
  } catch (error) {
    console.error("Seller auth error:", error);
    return NextResponse.json(
      { error: "Помилка автентифікації" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seller/auth - Check seller session
 */
export async function GET() {
  try {
    const result = await validateSellerSession();

    if (!result.valid || !result.seller) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      seller: {
        id: result.seller.id,
        discordId: result.seller.discordId,
        status: result.seller.status,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * DELETE /api/seller/auth - Seller Logout
 */
export async function DELETE() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Помилка виходу" },
      { status: 500 }
    );
  }
}
