import { cookies } from "next/headers";
import crypto from "crypto";
import {
  UserRole,
  SessionData,
  Seller,
  Buyer,
  User,
  canSellerAccessDashboard,
  isSellerBlocked,
  getSellerStatusMessage,
} from "./types";
import {
  getSellerByDiscordId,
  getSellerById,
  authenticateSellerWithPassword,
} from "./sellers";
import {
  getBuyerById,
  getBuyerByDiscordId,
  authenticateBuyer,
} from "./buyers";
import {
  getUserByDiscordId,
  getUserById,
  authenticateUser,
  userHasRole,
  ensureUserFromLegacy,
} from "./users";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store (cleared on server restart)
// For production with multiple instances, use Redis or DB
const sessions = new Map<string, SessionData>();

// ============================================
// COOKIE CONFIGURATION
// ============================================
// Environment variables for cookie settings:
// - COOKIE_SECURE: "true" | "false" | "auto" (default: "auto")
//   - "true": Always use Secure flag (HTTPS only)
//   - "false": Never use Secure flag (allows HTTP)
//   - "auto": Use Secure in production (NODE_ENV=production)
// - COOKIE_SAMESITE: "strict" | "lax" | "none" (default: "lax")
//   - "strict": Cookie not sent on cross-site requests (may break external access)
//   - "lax": Cookie sent on top-level navigations (recommended)
//   - "none": Cookie always sent (requires Secure=true)
// - COOKIE_DOMAIN: Optional domain for the cookie (e.g., ".example.com")

type SameSiteValue = "strict" | "lax" | "none";

function getCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSiteValue;
  maxAge: number;
  path: string;
  domain?: string;
} {
  // Determine secure flag
  const secureSetting = process.env.COOKIE_SECURE?.toLowerCase() || "auto";
  let secure: boolean;
  if (secureSetting === "true") {
    secure = true;
  } else if (secureSetting === "false") {
    secure = false;
  } else {
    // "auto" - use secure in production
    secure = process.env.NODE_ENV === "production";
  }

  // Determine sameSite - default to "lax" for better compatibility
  const sameSiteSetting = process.env.COOKIE_SAMESITE?.toLowerCase() as SameSiteValue | undefined;
  let sameSite: SameSiteValue = "lax"; // Changed default from "strict" to "lax"
  if (sameSiteSetting === "strict" || sameSiteSetting === "lax" || sameSiteSetting === "none") {
    sameSite = sameSiteSetting;
  }

  // If sameSite is "none", secure must be true
  if (sameSite === "none") {
    secure = true;
  }

  const options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: SameSiteValue;
    maxAge: number;
    path: string;
    domain?: string;
  } = {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  };

  // Optional domain setting
  const cookieDomain = process.env.COOKIE_DOMAIN;
  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
}

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================
// ADMIN AUTHENTICATION
// ============================================

/**
 * Verify the admin password
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable is not set");
    return false;
  }
  return constantTimeCompare(password, adminPassword);
}

/**
 * Create admin session
 */
export async function createAdminSession(): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  sessions.set(token, {
    role: "admin",
    roles: ["admin"],
    userId: "admin",
    discordId: "admin",
    expiresAt,
  });

  cleanupExpiredSessions();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions());

  return token;
}

// ============================================
// SELLER AUTHENTICATION
// ============================================

/**
 * Authenticate seller by Discord ID and password
 * Returns seller if credentials are valid and account status allows access
 */
export async function authenticateSeller(
  discordId: string,
  password: string
): Promise<{
  success: boolean;
  seller?: Seller;
  error?: string;
  statusMessage?: string;
}> {
  // First verify credentials
  const authResult = await authenticateSellerWithPassword(discordId, password);

  if (!authResult.success || !authResult.seller) {
    return { success: false, error: authResult.error || "Невірні облікові дані" };
  }

  const seller = authResult.seller;

  // Check account status
  if (isSellerBlocked(seller)) {
    return {
      success: false,
      error: "Доступ до облікового запису заборонено",
      statusMessage: getSellerStatusMessage(seller.status),
    };
  }

  if (!canSellerAccessDashboard(seller)) {
    return {
      success: false,
      error: "Доступ заборонено",
      statusMessage: getSellerStatusMessage(seller.status),
    };
  }

  return { success: true, seller };
}

/**
 * Create seller session (legacy - kept for backward compatibility)
 */
export async function createSellerSession(sellerId: string, discordId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  // Check if user also has buyer role
  const buyer = getBuyerByDiscordId(discordId);
  const roles: UserRole[] = ["seller"];
  if (buyer) {
    roles.push("buyer");
  }

  sessions.set(token, {
    role: "seller",
    roles,
    userId: sellerId,
    discordId,
    sellerId,
    buyerId: buyer?.id,
    expiresAt,
  });

  cleanupExpiredSessions();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions());

  return token;
}

// ============================================
// BUYER AUTHENTICATION
// ============================================

/**
 * Authenticate buyer by Discord ID and password
 * Returns buyer if credentials are valid
 */
export async function authenticateBuyerWithPassword(
  discordId: string,
  password: string
): Promise<{
  success: boolean;
  buyer?: Buyer;
  error?: string;
}> {
  return authenticateBuyer(discordId, password);
}

/**
 * Create buyer session (legacy - kept for backward compatibility)
 */
export async function createBuyerSession(buyerId: string, discordId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  // Check if user also has seller role (active seller only)
  const seller = getSellerByDiscordId(discordId);
  const roles: UserRole[] = ["buyer"];
  if (seller && canSellerAccessDashboard(seller)) {
    roles.push("seller");
  }

  sessions.set(token, {
    role: "buyer",
    roles,
    userId: buyerId,
    discordId,
    buyerId,
    sellerId: seller?.id,
    expiresAt,
  });

  cleanupExpiredSessions();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions());

  return token;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get current session data
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Validate session and check if user is admin
 */
export async function validateAdminSession(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

/**
 * Validate session and check if user is seller
 * Returns seller data if valid
 */
export async function validateSellerSession(): Promise<{
  valid: boolean;
  seller?: Seller;
}> {
  const session = await getSession();

  const sellerId = session?.sellerId || (session?.role === "seller" ? session?.userId : undefined);
  if (!session || session.role !== "seller" || !sellerId) {
    return { valid: false };
  }

  // Fetch current seller data to check status
  const seller = getSellerById(sellerId);
  if (!seller) {
    return { valid: false };
  }

  // Re-validate seller can access
  if (!canSellerAccessDashboard(seller)) {
    return { valid: false };
  }

  return { valid: true, seller };
}

/**
 * Validate session and check if user is buyer
 * Returns buyer data if valid
 */
export async function validateBuyerSession(): Promise<{
  valid: boolean;
  buyer?: Buyer;
}> {
  const session = await getSession();

  const buyerId = session?.buyerId || (session?.role === "buyer" ? session?.userId : undefined);
  if (!session || session.role !== "buyer" || !buyerId) {
    return { valid: false };
  }

  // Fetch current buyer data
  const buyer = getBuyerById(buyerId);
  if (!buyer) {
    return { valid: false };
  }

  return { valid: true, buyer };
}

/**
 * Validate session for any authenticated user
 * Returns role and user data if applicable
 */
export async function validateSession(): Promise<{
  authenticated: boolean;
  role?: UserRole;
  userId?: string;
  discordId?: string;
  sellerId?: string;
  seller?: Seller;
  buyerId?: string;
  buyer?: Buyer;
}> {
  const session = await getSession();

  if (!session) {
    return { authenticated: false };
  }

  if (session.role === "admin") {
    return {
      authenticated: true,
      role: "admin",
      userId: "admin",
      discordId: "admin",
    };
  }

  if (session.role === "seller") {
    const sellerId = session.sellerId || session.userId;
    if (sellerId) {
      const seller = getSellerById(sellerId);
      if (seller && canSellerAccessDashboard(seller)) {
        return {
          authenticated: true,
          role: "seller",
          userId: sellerId,
          discordId: session.discordId || seller.discordId,
          sellerId,
          seller,
        };
      }
    }
  }

  if (session.role === "buyer") {
    const buyerId = session.buyerId || session.userId;
    if (buyerId) {
      const buyer = getBuyerById(buyerId);
      if (buyer) {
        return {
          authenticated: true,
          role: "buyer",
          userId: buyerId,
          discordId: session.discordId || buyer.discordId,
          buyerId,
          buyer,
        };
      }
    }
  }

  return { authenticated: false };
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    sessions.delete(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  const expiredTokens: string[] = [];

  sessions.forEach((session, token) => {
    if (now > session.expiresAt) {
      expiredTokens.push(token);
    }
  });

  expiredTokens.forEach((token) => sessions.delete(token));
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * Check if current user can manage sellers (admin only)
 */
export async function canManageSellers(): Promise<boolean> {
  return validateAdminSession();
}

/**
 * Check if current user can view all inventory (admin only)
 */
export async function canViewAllInventory(): Promise<boolean> {
  return validateAdminSession();
}

/**
 * Check if current user can edit inventory for a specific seller
 */
export async function canEditSellerInventory(targetSellerId: string): Promise<boolean> {
  const session = await validateSession();

  if (!session.authenticated) {
    return false;
  }

  // Admin can edit any seller's inventory
  if (session.role === "admin") {
    return true;
  }

  // Seller can only edit their own inventory
  if (session.role === "seller" && session.sellerId === targetSellerId) {
    return true;
  }

  return false;
}

// ============================================
// UNIFIED MULTI-ROLE AUTHENTICATION
// ============================================

/**
 * Create a unified session with all user's roles
 * This is the preferred method for new code
 */
export async function createUnifiedSession(
  discordId: string,
  activeRole: UserRole
): Promise<{ success: boolean; token?: string; error?: string }> {
  // Get user's profiles to determine all roles
  const buyer = getBuyerByDiscordId(discordId);
  const seller = getSellerByDiscordId(discordId);

  const roles: UserRole[] = [];
  let buyerId: string | undefined;
  let sellerId: string | undefined;

  // Add buyer role if buyer profile exists
  if (buyer) {
    roles.push("buyer");
    buyerId = buyer.id;
  }

  // Add seller role only if seller profile exists AND is active
  if (seller && canSellerAccessDashboard(seller)) {
    roles.push("seller");
    sellerId = seller.id;
  }

  // Validate that user has the requested active role
  if (!roles.includes(activeRole)) {
    return {
      success: false,
      error: activeRole === "seller"
        ? "Немає активного облікового запису продавця"
        : "Немає облікового запису покупця",
    };
  }

  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  // Determine userId based on active role
  const userId = activeRole === "seller" ? sellerId! : buyerId!;

  sessions.set(token, {
    role: activeRole,
    roles,
    userId,
    discordId,
    buyerId,
    sellerId,
    expiresAt,
  });

  cleanupExpiredSessions();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions());

  return { success: true, token };
}

/**
 * Switch the active role in current session
 * User must already have the target role
 */
export async function switchActiveRole(
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return { success: false, error: "Сесія не знайдена" };
  }

  const session = sessions.get(token);
  if (!session) {
    return { success: false, error: "Сесія недійсна" };
  }

  // Check if session has roles array (for backward compatibility)
  const roles = session.roles || [session.role];

  // Check if user has the requested role
  if (!roles.includes(newRole)) {
    return {
      success: false,
      error: newRole === "seller"
        ? "Немає активного облікового запису продавця"
        : "Немає облікового запису покупця",
    };
  }

  // Additional check for seller: verify seller is still active
  if (newRole === "seller" && session.sellerId) {
    const seller = getSellerById(session.sellerId);
    if (!seller || !canSellerAccessDashboard(seller)) {
      return {
        success: false,
        error: "Обліковий запис продавця неактивний",
      };
    }
  }

  // Update the active role
  session.role = newRole;
  session.userId = newRole === "seller" ? session.sellerId! : session.buyerId!;

  sessions.set(token, session);

  return { success: true };
}

/**
 * Get current session with all roles
 * Extended version that includes roles array
 */
export async function getSessionWithRoles(): Promise<{
  authenticated: boolean;
  role?: UserRole;
  roles?: UserRole[];
  userId?: string;
  discordId?: string;
  sellerId?: string;
  seller?: Seller;
  buyerId?: string;
  buyer?: Buyer;
}> {
  const session = await getSession();

  if (!session) {
    return { authenticated: false };
  }

  if (session.role === "admin") {
    return {
      authenticated: true,
      role: "admin",
      roles: ["admin"],
      userId: "admin",
      discordId: "admin",
    };
  }

  // Build complete role/profile information
  let seller: Seller | undefined;
  let buyer: Buyer | undefined;
  const roles: UserRole[] = session.roles || [];

  // Get seller profile if sellerId exists
  if (session.sellerId) {
    const s = getSellerById(session.sellerId);
    if (s) {
      if (canSellerAccessDashboard(s)) {
        seller = s;
        if (!roles.includes("seller")) roles.push("seller");
      }
    }
  }

  // Get buyer profile if buyerId exists
  if (session.buyerId) {
    const b = getBuyerById(session.buyerId);
    if (b) {
      buyer = b;
      if (!roles.includes("buyer")) roles.push("buyer");
    }
  }

  // Fallback: try to find profiles by discordId if not in session
  if (!seller && !buyer && session.discordId) {
    const s = getSellerByDiscordId(session.discordId);
    if (s && canSellerAccessDashboard(s)) {
      seller = s;
      if (!roles.includes("seller")) roles.push("seller");
    }

    const b = getBuyerByDiscordId(session.discordId);
    if (b) {
      buyer = b;
      if (!roles.includes("buyer")) roles.push("buyer");
    }
  }

  // Validate current role is still valid
  let currentRole = session.role;
  if (currentRole === "seller" && !seller) {
    // Seller role no longer valid, switch to buyer if available
    if (buyer) {
      currentRole = "buyer";
    } else {
      return { authenticated: false };
    }
  }
  if (currentRole === "buyer" && !buyer) {
    // Buyer role no longer valid, switch to seller if available
    if (seller) {
      currentRole = "seller";
    } else {
      return { authenticated: false };
    }
  }

  return {
    authenticated: true,
    role: currentRole,
    roles,
    userId: currentRole === "seller" ? seller?.id : buyer?.id,
    discordId: session.discordId,
    sellerId: seller?.id,
    seller,
    buyerId: buyer?.id,
    buyer,
  };
}

/**
 * Unified login that handles both buyer and seller roles
 * Returns all roles the user has access to
 * Includes lazy backfill: auto-creates buyer profile for sellers if missing
 */
export async function unifiedLogin(
  discordId: string,
  password: string,
  preferredRole?: UserRole
): Promise<{
  success: boolean;
  roles?: UserRole[];
  activeRole?: UserRole;
  seller?: Seller;
  buyer?: Buyer;
  error?: string;
}> {
  // Try to authenticate as seller first (sellers have more restrictions)
  const sellerAuthResult = await authenticateSellerWithPassword(discordId, password);
  let buyerAuthResult = await authenticateBuyer(discordId, password);

  // Determine available roles
  const roles: UserRole[] = [];
  let seller: Seller | undefined;
  let buyer: Buyer | undefined;

  // LAZY BACKFILL: If seller authenticated but no buyer exists, auto-create buyer profile
  if (sellerAuthResult.success && sellerAuthResult.seller && !buyerAuthResult.success) {
    // Check if buyer exists (it might fail auth for other reasons)
    const existingBuyer = getBuyerByDiscordId(discordId);
    if (!existingBuyer && sellerAuthResult.seller.passwordHash) {
      // Auto-create buyer profile using seller's password hash
      try {
        const { createBuyerProfileForSeller } = await import("./buyers");
        const backfillResult = await createBuyerProfileForSeller(
          discordId,
          sellerAuthResult.seller.passwordHash
        );
        if (backfillResult.success && backfillResult.buyer) {
          console.log(`[LazyBackfill] Created buyer profile for seller on login: ${discordId}`);
          // Re-try buyer auth with the new profile
          buyerAuthResult = { success: true, buyer: backfillResult.buyer };
        }
      } catch (error) {
        console.error(`[LazyBackfill] Failed to create buyer for ${discordId}:`, error);
      }
    }
  }

  if (buyerAuthResult.success && buyerAuthResult.buyer) {
    roles.push("buyer");
    buyer = buyerAuthResult.buyer;
  }

  if (sellerAuthResult.success && sellerAuthResult.seller) {
    // Check seller status
    if (canSellerAccessDashboard(sellerAuthResult.seller)) {
      roles.push("seller");
      seller = sellerAuthResult.seller;
    }
  }

  // If no roles available, return error
  if (roles.length === 0) {
    // Generic error for security
    return {
      success: false,
      error: "Невірні облікові дані",
    };
  }

  // Determine active role
  let activeRole: UserRole;
  if (preferredRole && roles.includes(preferredRole)) {
    activeRole = preferredRole;
  } else {
    // Default to buyer if available, otherwise seller
    activeRole = roles.includes("buyer") ? "buyer" : "seller";
  }

  // Create unified session
  const sessionResult = await createUnifiedSession(discordId, activeRole);
  if (!sessionResult.success) {
    return {
      success: false,
      error: sessionResult.error || "Помилка створення сесії",
    };
  }

  return {
    success: true,
    roles,
    activeRole,
    seller,
    buyer,
  };
}

/**
 * Check if user has a specific role (based on current session)
 */
export async function sessionHasRole(role: UserRole): Promise<boolean> {
  const session = await getSessionWithRoles();
  if (!session.authenticated || !session.roles) {
    return false;
  }
  return session.roles.includes(role);
}
