/**
 * Buyer account management and storage
 * Buyers register instantly with Discord ID + password (no admin verification needed)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { safeWriteJson, safeReadJson, withFileLock } from "./safe-file";
import { Buyer, isValidDiscordId, DISCORD_ID_ERROR_MESSAGE } from "./types";
import { hashPassword, verifyPassword, validatePassword } from "./sellers";

// Data directory for buyers
const DATA_DIR = path.join(process.cwd(), "data");
const BUYERS_DIR = path.join(DATA_DIR, "buyers");

// ============================================
// DIRECTORY MANAGEMENT
// ============================================

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BUYERS_DIR)) {
    fs.mkdirSync(BUYERS_DIR, { recursive: true });
  }
}

function getBuyerFilePath(buyerId: string): string {
  const safeId = buyerId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(BUYERS_DIR, `${safeId}.json`);
}

// ============================================
// BUYER CRUD OPERATIONS
// ============================================

/**
 * Generate unique buyer ID
 */
export function generateBuyerId(): string {
  return crypto.randomUUID();
}

/**
 * Get buyer by ID
 */
export function getBuyerById(buyerId: string): Buyer | null {
  ensureDirectories();
  const filePath = getBuyerFilePath(buyerId);
  return safeReadJson<Buyer>(filePath);
}

/**
 * Get buyer by Discord ID
 */
export function getBuyerByDiscordId(discordId: string): Buyer | null {
  ensureDirectories();
  const buyers = getAllBuyers();
  return buyers.find((b) => b.discordId === discordId) || null;
}

/**
 * Get all buyers
 */
export function getAllBuyers(): Buyer[] {
  ensureDirectories();

  if (!fs.existsSync(BUYERS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BUYERS_DIR).filter((f) => f.endsWith(".json"));
  const buyers: Buyer[] = [];

  for (const file of files) {
    const filePath = path.join(BUYERS_DIR, file);
    const buyer = safeReadJson<Buyer>(filePath);
    if (buyer && buyer.id) {
      buyers.push(buyer);
    }
  }

  return buyers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Check if Discord ID is already registered (as buyer or seller)
 * @param discordId - Discord ID to check
 * @param excludeBuyerId - Optional buyer ID to exclude from check (for updates)
 */
export function isDiscordIdTaken(discordId: string, excludeBuyerId?: string): boolean {
  // Check buyers
  const buyers = getAllBuyers();
  const buyerExists = buyers.some((b) => b.discordId === discordId && b.id !== excludeBuyerId);
  if (buyerExists) return true;

  // Check sellers (import dynamically to avoid circular dependency)
  // We'll check this in the registration function by passing a function
  return false;
}

/**
 * Register a new buyer (instant with password, no admin verification needed)
 */
export async function registerBuyer(
  discordId: string,
  password: string,
  checkSellerExists?: (discordId: string) => boolean
): Promise<{ success: boolean; buyer?: Buyer; error?: string }> {
  ensureDirectories();

  // Validate Discord ID format
  if (!isValidDiscordId(discordId)) {
    return {
      success: false,
      error: DISCORD_ID_ERROR_MESSAGE,
    };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return {
      success: false,
      error: passwordValidation.error || "Невірний пароль",
    };
  }

  // Check if Discord ID is already registered as buyer
  const existingBuyer = getBuyerByDiscordId(discordId);
  if (existingBuyer) {
    return {
      success: false,
      error: "Цей Discord ID вже зареєстрований як покупець",
    };
  }

  // Check if Discord ID is already registered as seller (if check function provided)
  if (checkSellerExists && checkSellerExists(discordId)) {
    return {
      success: false,
      error: "Цей Discord ID вже зареєстрований як продавець",
    };
  }

  // Hash password using bcrypt
  const passwordHash = await hashPassword(password);

  const buyerId = generateBuyerId();
  const now = new Date().toISOString();

  const buyer: Buyer = {
    id: buyerId,
    discordId,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getBuyerFilePath(buyerId);
  safeWriteJson(filePath, buyer);

  return { success: true, buyer };
}

/**
 * Update buyer Discord ID (with validation)
 */
export async function updateBuyerDiscordId(
  buyerId: string,
  newDiscordId: string,
  checkSellerExists?: (discordId: string) => boolean
): Promise<{ success: boolean; error?: string }> {
  const filePath = getBuyerFilePath(buyerId);

  return withFileLock(filePath, () => {
    const buyer = getBuyerById(buyerId);
    if (!buyer) {
      return { success: false, error: "Покупця не знайдено" };
    }

    // Validate Discord ID format
    if (!isValidDiscordId(newDiscordId)) {
      return {
        success: false,
        error: DISCORD_ID_ERROR_MESSAGE,
      };
    }

    // Check if new Discord ID is already taken by another buyer
    const existingBuyer = getBuyerByDiscordId(newDiscordId);
    if (existingBuyer && existingBuyer.id !== buyerId) {
      return {
        success: false,
        error: "Цей Discord ID вже зареєстрований як покупець",
      };
    }

    // Check if Discord ID is already registered as seller
    if (checkSellerExists && checkSellerExists(newDiscordId)) {
      return {
        success: false,
        error: "Цей Discord ID вже зареєстрований як продавець",
      };
    }

    buyer.discordId = newDiscordId;
    buyer.updatedAt = new Date().toISOString();

    safeWriteJson(filePath, buyer);

    return { success: true };
  });
}

/**
 * Delete buyer (admin only)
 */
export function deleteBuyer(buyerId: string): boolean {
  const filePath = getBuyerFilePath(buyerId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Count total buyers
 */
export function countBuyers(): number {
  return getAllBuyers().length;
}

/**
 * Authenticate buyer by Discord ID and password
 * Returns the buyer if credentials are valid
 */
export async function authenticateBuyer(
  discordId: string,
  password: string
): Promise<{ success: boolean; buyer?: Buyer; error?: string }> {
  if (!isValidDiscordId(discordId)) {
    // Use generic error to prevent user enumeration
    return {
      success: false,
      error: "Невірні облікові дані",
    };
  }

  const buyer = getBuyerByDiscordId(discordId);
  if (!buyer) {
    // Use generic error to prevent user enumeration
    return {
      success: false,
      error: "Невірні облікові дані",
    };
  }

  // Check if buyer has a password hash (for backward compatibility with old accounts)
  if (!buyer.passwordHash) {
    return {
      success: false,
      error: "Обліковий запис потребує оновлення. Зверніться до підтримки.",
    };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, buyer.passwordHash);
  if (!isValidPassword) {
    // Use generic error to prevent user enumeration
    return {
      success: false,
      error: "Невірні облікові дані",
    };
  }

  return { success: true, buyer };
}

// ============================================
// UNIFIED ACCOUNT HELPERS
// ============================================

/**
 * Create buyer profile for a seller (unified account system)
 * Uses the same password hash as the seller - no password needed
 * This is called automatically when a seller registers
 */
export async function createBuyerProfileForSeller(
  discordId: string,
  passwordHash: string
): Promise<{ success: boolean; buyer?: Buyer; error?: string }> {
  ensureDirectories();

  // Validate Discord ID format
  if (!isValidDiscordId(discordId)) {
    return {
      success: false,
      error: DISCORD_ID_ERROR_MESSAGE,
    };
  }

  // Check if buyer profile already exists
  const existingBuyer = getBuyerByDiscordId(discordId);
  if (existingBuyer) {
    // Already exists, just return it
    return { success: true, buyer: existingBuyer };
  }

  const buyerId = generateBuyerId();
  const now = new Date().toISOString();

  const buyer: Buyer = {
    id: buyerId,
    discordId,
    passwordHash, // Use the same hash as seller
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getBuyerFilePath(buyerId);
  safeWriteJson(filePath, buyer);

  return { success: true, buyer };
}

/**
 * Check if buyer profile exists (for unified login checking)
 */
export function buyerProfileExists(discordId: string): boolean {
  const buyer = getBuyerByDiscordId(discordId);
  return buyer !== null;
}
