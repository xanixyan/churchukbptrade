/**
 * Simple in-memory rate limiter
 * Limits requests per IP address
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  });
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** When the limit resets (Unix timestamp) */
  resetAt: number;
  /** Seconds until reset */
  retryAfter: number;
}

/**
 * Check and update rate limit for a given key (usually IP address)
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 3, windowMs: 5 * 60 * 1000 } // Default: 3 requests per 5 minutes
): RateLimitResult {
  cleanupOldEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
      retryAfter: 0,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    retryAfter: 0,
  };
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  // Check various headers for the real IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback
  return "unknown";
}
