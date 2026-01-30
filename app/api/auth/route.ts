import { NextRequest, NextResponse } from "next/server";
import {
  authenticateSeller,
  authenticateBuyerWithPassword,
  createSellerSession,
  createBuyerSession,
  validateSession,
  destroySession,
  unifiedLogin,
  getSessionWithRoles,
  switchActiveRole,
} from "@/lib/auth";
import { registerBuyer, getBuyerByDiscordId, createBuyerProfileForSeller } from "@/lib/buyers";
import { getSellerByDiscordId, validatePassword, hashPassword } from "@/lib/sellers";
import { isValidDiscordId, DISCORD_ID_ERROR_MESSAGE, UserRole } from "@/lib/types";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

// Rate limit config
const LOGIN_RATE_LIMIT = { maxRequests: 5, windowMs: 15 * 60 * 1000 };
const REGISTER_RATE_LIMIT = { maxRequests: 3, windowMs: 15 * 60 * 1000 };

/**
 * POST /api/auth - Unified Login/Register
 * Supports both buyers and sellers
 *
 * Body:
 * - action: "login" | "register"
 * - role: "buyer" | "seller"
 * - discordId: string
 * - password?: string (required for seller)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, role, discordId, password } = body;

    // Validate action
    if (!action || (action !== "login" && action !== "register")) {
      return NextResponse.json(
        { error: "Невірна дія. Використовуйте 'login' або 'register'" },
        { status: 400 }
      );
    }

    // Validate role
    if (!role || (role !== "buyer" && role !== "seller")) {
      return NextResponse.json(
        { error: "Невірна роль. Використовуйте 'buyer' або 'seller'" },
        { status: 400 }
      );
    }

    // Validate Discord ID
    if (!discordId || typeof discordId !== "string") {
      return NextResponse.json(
        { error: "Discord ID обов'язковий" },
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

    // Get client IP for rate limiting
    const clientIP = getClientIP(request.headers);

    // Handle different actions and roles
    if (action === "login") {
      return handleLogin(role, trimmedDiscordId, password, clientIP);
    } else {
      return handleRegister(role, trimmedDiscordId, password, clientIP);
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Помилка автентифікації" },
      { status: 500 }
    );
  }
}

/**
 * Handle login for both buyers and sellers
 * Uses unified authentication to support multi-role accounts
 */
async function handleLogin(
  role: "buyer" | "seller",
  discordId: string,
  password: string | undefined,
  clientIP: string
): Promise<NextResponse> {
  // Rate limit check
  const rateLimitKey = `login:${clientIP}`;
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
        },
      }
    );
  }

  // Validate Discord ID
  if (!isValidDiscordId(discordId)) {
    return NextResponse.json(
      { error: DISCORD_ID_ERROR_MESSAGE },
      { status: 400 }
    );
  }

  // Password required for all logins
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Пароль обов'язковий" },
      { status: 400 }
    );
  }

  // Use unified login - this handles both buyer and seller authentication
  // and creates a session with all available roles
  const loginResult = await unifiedLogin(discordId, password, role as UserRole);

  if (!loginResult.success) {
    return NextResponse.json(
      { error: loginResult.error || "Невірні облікові дані" },
      { status: 401 }
    );
  }

  // Build response based on active role
  const activeRole = loginResult.activeRole!;
  const user = activeRole === "seller"
    ? {
        id: loginResult.seller!.id,
        discordId: loginResult.seller!.discordId,
        status: loginResult.seller!.status,
      }
    : {
        id: loginResult.buyer!.id,
        discordId: loginResult.buyer!.discordId,
      };

  return NextResponse.json({
    success: true,
    role: activeRole,
    roles: loginResult.roles, // All roles the user has
    user,
    // Include info about other available roles
    hasSellerRole: loginResult.roles?.includes("seller"),
    hasBuyerRole: loginResult.roles?.includes("buyer"),
  });
}

/**
 * Handle registration for both buyers and sellers
 * Supports unified accounts: if seller exists, buyer can use same credentials
 */
async function handleRegister(
  role: "buyer" | "seller",
  discordId: string,
  password: string | undefined,
  clientIP: string
): Promise<NextResponse> {
  // Rate limit check
  const rateLimitKey = `register:${clientIP}`;
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
        },
      }
    );
  }

  // Validate Discord ID
  if (!isValidDiscordId(discordId)) {
    return NextResponse.json(
      { error: DISCORD_ID_ERROR_MESSAGE },
      { status: 400 }
    );
  }

  // Check if Discord ID is already used
  const existingBuyer = getBuyerByDiscordId(discordId);
  const existingSeller = getSellerByDiscordId(discordId);

  if (role === "seller") {
    // Seller registration - redirect to existing flow
    // Sellers need verification, so we return info about the seller registration page
    return NextResponse.json(
      {
        error: "Для реєстрації продавця скористайтесь спеціальною формою",
        redirect: "/seller/register"
      },
      { status: 400 }
    );
  }

  // Buyer registration
  // Password required
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Пароль обов'язковий" },
      { status: 400 }
    );
  }

  // Validate password requirements
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return NextResponse.json(
      { error: passwordValidation.error || "Невірний пароль" },
      { status: 400 }
    );
  }

  // UNIFIED ACCOUNT: If seller exists, create buyer profile with same credentials
  if (existingSeller && !existingBuyer) {
    // Verify password matches seller's password
    const { authenticateSellerWithPassword } = await import("@/lib/sellers");
    const sellerAuth = await authenticateSellerWithPassword(discordId, password);

    if (!sellerAuth.success) {
      return NextResponse.json(
        { error: "Невірний пароль для існуючого облікового запису продавця" },
        { status: 400 }
      );
    }

    // Create buyer profile with same password hash
    const buyerResult = await createBuyerProfileForSeller(
      discordId,
      existingSeller.passwordHash
    );

    if (!buyerResult.success || !buyerResult.buyer) {
      return NextResponse.json(
        { error: buyerResult.error || "Помилка створення профілю покупця" },
        { status: 400 }
      );
    }

    // Auto-login with buyer role
    await createBuyerSession(buyerResult.buyer.id, buyerResult.buyer.discordId);

    return NextResponse.json({
      success: true,
      role: "buyer",
      roles: existingSeller.status === "active" ? ["buyer", "seller"] : ["buyer"],
      user: {
        id: buyerResult.buyer.id,
        discordId: buyerResult.buyer.discordId,
      },
      message: "Профіль покупця створено! Ви можете використовувати ті ж облікові дані.",
      hasSellerRole: existingSeller.status === "active",
    });
  }

  // Check if buyer already exists
  if (existingBuyer) {
    return NextResponse.json(
      { error: "Цей Discord ID вже зареєстрований. Спробуйте увійти." },
      { status: 400 }
    );
  }

  // Standard buyer registration (no seller account exists)
  // Don't check for seller collision since we handle it above
  const result = await registerBuyer(discordId, password);

  if (!result.success || !result.buyer) {
    return NextResponse.json(
      { error: result.error || "Помилка реєстрації" },
      { status: 400 }
    );
  }

  // Auto-login after registration
  await createBuyerSession(result.buyer.id, result.buyer.discordId);

  return NextResponse.json({
    success: true,
    role: "buyer",
    roles: ["buyer"],
    user: {
      id: result.buyer.id,
      discordId: result.buyer.discordId,
    },
    message: "Реєстрація успішна! Ви увійшли в систему.",
  });
}

/**
 * GET /api/auth - Check current session with roles
 */
export async function GET() {
  try {
    const session = await getSessionWithRoles();

    if (!session.authenticated) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      roles: session.roles, // All roles the user has
      user: {
        id: session.userId,
        discordId: session.discordId,
        ...(session.seller && { status: session.seller.status }),
      },
      // Include info about other available roles
      hasSellerRole: session.roles?.includes("seller"),
      hasBuyerRole: session.roles?.includes("buyer"),
      sellerId: session.sellerId,
      buyerId: session.buyerId,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * DELETE /api/auth - Logout
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

/**
 * PATCH /api/auth - Switch active role
 * Body: { role: "buyer" | "seller" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { role } = body;

    // Validate role
    if (!role || (role !== "buyer" && role !== "seller")) {
      return NextResponse.json(
        { error: "Невірна роль. Використовуйте 'buyer' або 'seller'" },
        { status: 400 }
      );
    }

    // Switch role
    const result = await switchActiveRole(role as UserRole);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Помилка зміни ролі" },
        { status: 400 }
      );
    }

    // Get updated session info
    const session = await getSessionWithRoles();

    return NextResponse.json({
      success: true,
      role: session.role,
      roles: session.roles,
      user: {
        id: session.userId,
        discordId: session.discordId,
        ...(session.seller && { status: session.seller.status }),
      },
    });
  } catch (error) {
    console.error("Role switch error:", error);
    return NextResponse.json(
      { error: "Помилка зміни ролі" },
      { status: 500 }
    );
  }
}
