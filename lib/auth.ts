import { cookies } from "next/headers";
import crypto from "crypto";
import {
  UserRole,
  SessionData,
  Seller,
  canSellerAccessDashboard,
  isSellerPendingVerification,
  isSellerBlocked,
  getSellerStatusMessage,
} from "./types";
import {
  getSellerByDiscordId,
  getSellerById,
  authenticateSellerWithPassword,
} from "./sellers";

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

  if (isSellerPendingVerification(seller)) {
    return {
      success: false,
      error: "Обліковий запис очікує підтвердження",
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
 * Create seller session
 */
export async function createSellerSession(sellerId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  sessions.set(token, {
    role: "seller",
    sellerId,
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

  if (!session || session.role !== "seller" || !session.sellerId) {
    return { valid: false };
  }

  // Fetch current seller data to check status
  const seller = getSellerById(session.sellerId);
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
 * Validate session for any authenticated user
 * Returns role and seller data if applicable
 */
export async function validateSession(): Promise<{
  authenticated: boolean;
  role?: UserRole;
  sellerId?: string;
  seller?: Seller;
}> {
  const session = await getSession();

  if (!session) {
    return { authenticated: false };
  }

  if (session.role === "admin") {
    return { authenticated: true, role: "admin" };
  }

  if (session.role === "seller" && session.sellerId) {
    const seller = getSellerById(session.sellerId);
    if (seller && canSellerAccessDashboard(seller)) {
      return {
        authenticated: true,
        role: "seller",
        sellerId: session.sellerId,
        seller,
      };
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
