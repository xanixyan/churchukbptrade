import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
  Seller,
  SellerStatus,
  SellerWithInventory,
  SellerInventoryItem,
  SellerListing,
  ItemPrice,
  QueueState,
  BlueprintQueueState,
  BlueprintSellersResponse,
  isValidSellerStatus,
  validateItemPrice,
  normalizeItemPrice,
  PRICE_TYPES,
  SELLER_PUBLIC_NOTE_MAX_LENGTH,
} from "./types";
import { safeWriteJson, safeReadJson, withFileLock } from "./safe-file";

// Data directories
const DATA_DIR = path.join(process.cwd(), "data");
const SELLERS_DIR = path.join(DATA_DIR, "sellers");
const QUEUE_FILE = path.join(DATA_DIR, "seller-queue.json");

// Password hashing configuration
const BCRYPT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Ensure data directories exist
function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SELLERS_DIR)) {
    fs.mkdirSync(SELLERS_DIR, { recursive: true });
  }
}

// Generate unique seller ID
function generateSellerId(): string {
  return crypto.randomUUID();
}

// Get seller file path
function getSellerFilePath(sellerId: string): string {
  return path.join(SELLERS_DIR, `${sellerId}.json`);
}

// ============================================
// PASSWORD UTILITIES
// ============================================

/**
 * Validate password requirements (Ukrainian messages)
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Пароль обов'язковий" };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів` };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Пароль занадто довгий (макс. ${MAX_PASSWORD_LENGTH} символів)` };
  }

  return { valid: true };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// SELLER REGISTRATION & AUTHENTICATION
// ============================================

/**
 * Validate Discord ID format (username-style)
 * Accepts: letters, numbers, underscore, dot, dash (2-32 chars)
 * Also accepts legacy numeric IDs for backward compatibility
 */
export function validateDiscordId(discordId: string): { valid: boolean; error?: string } {
  if (!discordId || typeof discordId !== "string") {
    return { valid: false, error: "Discord нік обов'язковий" };
  }

  const trimmed = discordId.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Discord нік не може бути порожнім" };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: "Discord нік занадто короткий (мін. 2 символи)" };
  }

  if (trimmed.length > 32) {
    return { valid: false, error: "Discord нік занадто довгий (макс. 32 символи)" };
  }

  // Username format OR legacy numeric format for backward compatibility
  const usernameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { valid: false, error: "Невірний Discord нік. Дозволені символи: літери, цифри, _, ., -" };
  }

  return { valid: true };
}

/**
 * Register a new seller account
 * Creates account with ACTIVE status (no admin approval needed)
 */
export async function registerSeller(
  discordId: string,
  password: string
): Promise<{ success: boolean; seller?: Seller; error?: string }> {
  ensureDirectories();

  // Validate Discord ID
  const discordValidation = validateDiscordId(discordId);
  if (!discordValidation.valid) {
    return { success: false, error: discordValidation.error };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  // Check if seller with this Discord ID already exists
  const existing = getSellerByDiscordId(discordId);
  if (existing) {
    return { success: false, error: "Продавець з таким Discord ID вже існує" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  const now = new Date().toISOString();
  const seller: SellerWithInventory = {
    id: generateSellerId(),
    discordId: discordId.trim(),
    passwordHash,
    status: "active",
    createdAt: now,
    updatedAt: now,
    inventory: [],
  };

  const filePath = getSellerFilePath(seller.id);
  safeWriteJson(filePath, seller);

  return { success: true, seller };
}

/**
 * Authenticate seller with Discord ID and password (Ukrainian messages)
 */
export async function authenticateSellerWithPassword(
  discordId: string,
  password: string
): Promise<{ success: boolean; seller?: SellerWithInventory; error?: string }> {
  // Find seller by Discord ID
  const seller = getSellerByDiscordId(discordId);

  if (!seller) {
    // Use generic error message to prevent user enumeration
    return { success: false, error: "Невірні облікові дані" };
  }

  // Check if seller has a password hash (for backward compatibility)
  if (!seller.passwordHash) {
    return { success: false, error: "Зверніться до адміністратора для налаштування облікового запису" };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, seller.passwordHash);
  if (!isValidPassword) {
    return { success: false, error: "Невірні облікові дані" };
  }

  return { success: true, seller };
}

/**
 * Create a seller account (admin-created, for backward compatibility)
 * Note: Admin-created accounts don't have passwords and need to be set up
 */
export function createSeller(discordId: string): Seller {
  ensureDirectories();

  // Check if seller with this Discord ID already exists
  const existing = getSellerByDiscordId(discordId);
  if (existing) {
    throw new Error(`Seller with Discord ID "${discordId}" already exists`);
  }

  const now = new Date().toISOString();
  const seller: SellerWithInventory = {
    id: generateSellerId(),
    discordId: discordId.trim(),
    passwordHash: "", // Admin-created accounts need password setup
    status: "active",
    createdAt: now,
    updatedAt: now,
    inventory: [],
  };

  const filePath = getSellerFilePath(seller.id);
  safeWriteJson(filePath, seller);

  return seller;
}

/**
 * Set or update seller password (for admin-created accounts)
 * Uses file locking to prevent race conditions.
 */
export async function setSellerPassword(
  sellerId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // Validate password (outside lock - no file I/O)
  const validation = validatePassword(password);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Hash password (outside lock - CPU-bound, no file I/O)
  const passwordHash = await hashPassword(password);

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return { success: false, error: "Seller not found" };
    }

    // Modify in memory
    seller.passwordHash = passwordHash;
    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return { success: true };
  });
}

// ============================================
// SELLER CRUD OPERATIONS
// ============================================

/**
 * Get seller by internal ID
 */
export function getSellerById(sellerId: string): SellerWithInventory | null {
  ensureDirectories();
  const filePath = getSellerFilePath(sellerId);
  const seller = safeReadJson<SellerWithInventory>(filePath);
  if (seller && !seller.inventory) {
    seller.inventory = [];
  }
  // Read-time migration: comment -> publicNote
  if (seller) {
    migrateCommentToPublicNote(seller);
  }
  return seller;
}

/**
 * Read-time migration: rename legacy `comment` field to `publicNote`.
 * Does NOT write to disk — caller is responsible for saving if needed.
 */
function migrateCommentToPublicNote(seller: SellerWithInventory): void {
  if (!seller.inventory) return;
  for (const item of seller.inventory) {
    if (item.comment !== undefined && item.publicNote === undefined) {
      item.publicNote = item.comment;
      delete item.comment;
    }
  }
}

/**
 * Get seller by Discord ID (username or numeric ID)
 */
export function getSellerByDiscordId(discordId: string): SellerWithInventory | null {
  ensureDirectories();
  const sellers = getAllSellers();
  return sellers.find((s) => s.discordId.toLowerCase() === discordId.toLowerCase()) || null;
}

/**
 * Get all sellers
 */
export function getAllSellers(): SellerWithInventory[] {
  ensureDirectories();

  if (!fs.existsSync(SELLERS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SELLERS_DIR).filter((f) => f.endsWith(".json"));
  const sellers: SellerWithInventory[] = [];

  for (const file of files) {
    const filePath = path.join(SELLERS_DIR, file);
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (seller && seller.id && seller.discordId) {
      // Ensure inventory array exists
      if (!seller.inventory) {
        seller.inventory = [];
      }
      // Ensure passwordHash exists (for backward compatibility)
      if (!seller.passwordHash) {
        seller.passwordHash = "";
      }
      migrateCommentToPublicNote(seller);
      sellers.push(seller);
    }
  }

  return sellers.sort((a, b) => a.discordId.localeCompare(b.discordId));
}

/**
 * Get all active sellers
 */
export function getActiveSellers(): SellerWithInventory[] {
  return getAllSellers().filter((s) => s.status === "active");
}


/**
 * Update seller status
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerStatus(
  sellerId: string,
  status: SellerStatus
): Promise<Seller | null> {
  // Validate status outside lock
  if (!isValidSellerStatus(status)) {
    throw new Error(`Invalid seller status: ${status}`);
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return null;
    }

    // Modify in memory
    seller.status = status;
    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return seller;
  });
}

/**
 * Update seller's Telegram chat ID
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerTelegramChatId(
  sellerId: string,
  telegramChatId: string | undefined
): Promise<Seller | null> {
  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return null;
    }

    // Modify in memory
    seller.telegramChatId = telegramChatId?.trim() || undefined;
    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return seller;
  });
}

/**
 * Update seller's Discord ID
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerDiscordId(
  sellerId: string,
  discordId: string
): Promise<Seller | null> {
  // Check if new Discord ID is already taken by another seller (outside lock - read-only)
  const existing = getSellerByDiscordId(discordId);
  if (existing && existing.id !== sellerId) {
    throw new Error(`Discord ID "${discordId}" is already used by another seller`);
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return null;
    }

    // Modify in memory
    seller.discordId = discordId.trim();
    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return seller;
  });
}

/**
 * Delete seller (admin only)
 */
export function deleteSeller(sellerId: string): boolean {
  const filePath = getSellerFilePath(sellerId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

// ============================================
// SELLER INVENTORY OPERATIONS
// ============================================

/**
 * Get seller's inventory
 */
export function getSellerInventory(sellerId: string): SellerInventoryItem[] {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return [];
  }
  return seller.inventory || [];
}

/**
 * Update seller's inventory for a specific blueprint (quantity only)
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerInventoryItem(
  sellerId: string,
  blueprintId: string,
  quantity: number
): Promise<boolean> {
  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return false;
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    // Validate quantity
    const qty = Math.max(0, Math.floor(quantity));

    // Find existing inventory item
    const existingIndex = seller.inventory.findIndex((item) => item.blueprintId === blueprintId);

    if (qty === 0) {
      // Remove item if quantity is 0
      if (existingIndex >= 0) {
        seller.inventory.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      // Update existing
      seller.inventory[existingIndex].quantity = qty;
    } else {
      // Add new
      seller.inventory.push({ blueprintId, quantity: qty });
    }

    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return true;
  });
}

/**
 * Bulk update seller's inventory
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerInventoryBulk(
  sellerId: string,
  updates: { blueprintId: string; quantity: number }[]
): Promise<boolean> {
  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return false;
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    for (const update of updates) {
      const qty = Math.max(0, Math.floor(update.quantity));
      const existingIndex = seller.inventory.findIndex(
        (item) => item.blueprintId === update.blueprintId
      );

      if (qty === 0) {
        if (existingIndex >= 0) {
          seller.inventory.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        seller.inventory[existingIndex].quantity = qty;
      } else {
        seller.inventory.push({ blueprintId: update.blueprintId, quantity: qty });
      }
    }

    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return true;
  });
}

/**
 * Get seller's quantity for a specific blueprint
 */
export function getSellerBlueprintQuantity(sellerId: string, blueprintId: string): number {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return 0;
  }
  const item = seller.inventory.find((i) => i.blueprintId === blueprintId);
  return item?.quantity || 0;
}

/**
 * Get seller's price for a specific blueprint.
 * Returns ItemPrice object (normalized from legacy numeric or new structure).
 */
export function getSellerBlueprintPrice(sellerId: string, blueprintId: string): ItemPrice {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return { type: "Договірна" };
  }
  const item = seller.inventory.find((i) => i.blueprintId === blueprintId);
  return normalizeItemPrice(item?.price);
}

/**
 * Update seller's inventory item with quantity and/or price.
 * Supports new ItemPrice structure.
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerInventoryItemWithPrice(
  sellerId: string,
  blueprintId: string,
  quantity: number,
  price: ItemPrice | number | null | undefined,
  validBlueprintIds?: Set<string>
): Promise<{ success: boolean; error?: string }> {
  // Validate price if provided
  if (price !== null && price !== undefined) {
    const priceValidation = validateItemPrice(price, validBlueprintIds);
    if (!priceValidation.valid) {
      return { success: false, error: priceValidation.error };
    }
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return { success: false, error: "Продавця не знайдено" };
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    // Validate quantity
    const qty = Math.max(0, Math.floor(quantity));
    const normalizedPrice = normalizeItemPrice(price);

    // Find existing inventory item
    const existingIndex = seller.inventory.findIndex((item) => item.blueprintId === blueprintId);

    if (qty === 0) {
      // Remove item if quantity is 0
      if (existingIndex >= 0) {
        seller.inventory.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      // Update existing - preserve price if not provided
      seller.inventory[existingIndex].quantity = qty;
      if (price !== undefined) {
        seller.inventory[existingIndex].price = normalizedPrice;
      }
    } else {
      // Add new
      seller.inventory.push({ blueprintId, quantity: qty, price: normalizedPrice });
    }

    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return { success: true };
  });
}

/**
 * Update only the price for a specific inventory item.
 * Does NOT modify quantity. Item must already exist in inventory.
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerInventoryPrice(
  sellerId: string,
  blueprintId: string,
  price: ItemPrice | null,
  validBlueprintIds?: Set<string>
): Promise<{ success: boolean; error?: string }> {
  // Validate price
  const priceValidation = validateItemPrice(price, validBlueprintIds);
  if (!priceValidation.valid) {
    return { success: false, error: priceValidation.error };
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return { success: false, error: "Продавця не знайдено" };
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    // Find existing inventory item
    const existingIndex = seller.inventory.findIndex((item) => item.blueprintId === blueprintId);

    if (existingIndex < 0) {
      return { success: false, error: "Креслення не знайдено в інвентарі" };
    }

    // Update price (normalize it)
    seller.inventory[existingIndex].price = normalizeItemPrice(price);
    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return { success: true };
  });
}

/**
 * Update the public note for a specific inventory item.
 * Seller can set, edit, or clear (null) their note.
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerPublicNote(
  sellerId: string,
  blueprintId: string,
  publicNote: string | null
): Promise<{ success: boolean; error?: string }> {
  // Validate note
  if (publicNote !== null) {
    const trimmed = publicNote.trim();
    if (trimmed.length === 0) {
      publicNote = null; // empty/whitespace-only -> clear
    } else if (trimmed.length > SELLER_PUBLIC_NOTE_MAX_LENGTH) {
      return { success: false, error: `Нотатка занадто довга (макс. ${SELLER_PUBLIC_NOTE_MAX_LENGTH} символів)` };
    } else {
      // Escape HTML for safe rendering
      publicNote = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return { success: false, error: "Продавця не знайдено" };
    }

    if (!seller.inventory) {
      seller.inventory = [];
    }

    // Apply migration for this seller
    migrateCommentToPublicNote(seller);

    const existingIndex = seller.inventory.findIndex((item) => item.blueprintId === blueprintId);

    if (existingIndex < 0) {
      seller.inventory.push({ blueprintId, quantity: 0, publicNote });
    } else {
      seller.inventory[existingIndex].publicNote = publicNote;
      // Remove legacy field if present
      delete seller.inventory[existingIndex].comment;
    }

    seller.updatedAt = new Date().toISOString();
    safeWriteJson(filePath, seller);

    return { success: true };
  });
}

/**
 * Bulk update seller's inventory with quantity and price support.
 * Supports new ItemPrice structure.
 * Uses file locking to prevent race conditions.
 */
export async function updateSellerInventoryBulkWithPrice(
  sellerId: string,
  updates: { blueprintId: string; quantity: number; price?: ItemPrice | number | null }[],
  validBlueprintIds?: Set<string>
): Promise<{ success: boolean; error?: string }> {
  // Validate all prices first
  for (const update of updates) {
    if (update.price !== null && update.price !== undefined) {
      const priceValidation = validateItemPrice(update.price, validBlueprintIds);
      if (!priceValidation.valid) {
        return { success: false, error: priceValidation.error };
      }
    }
  }

  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return { success: false, error: "Продавця не знайдено" };
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    for (const update of updates) {
      const qty = Math.max(0, Math.floor(update.quantity));
      const existingIndex = seller.inventory.findIndex(
        (item) => item.blueprintId === update.blueprintId
      );

      if (qty === 0) {
        if (existingIndex >= 0) {
          seller.inventory.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        seller.inventory[existingIndex].quantity = qty;
        // Only update price if explicitly provided
        if (update.price !== undefined) {
          seller.inventory[existingIndex].price = normalizeItemPrice(update.price);
        }
      } else {
        seller.inventory.push({
          blueprintId: update.blueprintId,
          quantity: qty,
          price: normalizeItemPrice(update.price),
        });
      }
    }

    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return { success: true };
  });
}

/**
 * Atomically adjust seller's inventory quantity by a delta value.
 * Uses file locking to ensure read-modify-write is atomic.
 * Positive delta = increment, negative delta = decrement.
 * Returns the new quantity, or null if seller not found.
 */
export async function adjustSellerInventoryItem(
  sellerId: string,
  blueprintId: string,
  delta: number
): Promise<number | null> {
  const filePath = getSellerFilePath(sellerId);

  return withFileLock(filePath, () => {
    // Read seller inside lock
    const seller = safeReadJson<SellerWithInventory>(filePath);
    if (!seller) {
      return null;
    }

    // Ensure inventory array exists
    if (!seller.inventory) {
      seller.inventory = [];
    }

    // Find existing inventory item
    const existingIndex = seller.inventory.findIndex((item) => item.blueprintId === blueprintId);
    let currentQty = 0;

    if (existingIndex >= 0) {
      currentQty = seller.inventory[existingIndex].quantity;
    }

    // Calculate new quantity (ensure non-negative)
    const newQty = Math.max(0, Math.floor(currentQty + delta));

    if (newQty === 0) {
      // Remove item if quantity is 0
      if (existingIndex >= 0) {
        seller.inventory.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      // Update existing
      seller.inventory[existingIndex].quantity = newQty;
    } else {
      // Add new
      seller.inventory.push({ blueprintId, quantity: newQty });
    }

    seller.updatedAt = new Date().toISOString();

    // Write once
    safeWriteJson(filePath, seller);

    return newQty;
  });
}

// ============================================
// AGGREGATED INVENTORY (for public catalog)
// ============================================

/**
 * Get aggregated inventory across all active sellers
 * Returns total available quantity per blueprint
 * Only counts inventory from ACTIVE sellers
 */
export function getAggregatedInventory(): Map<string, { totalQty: number; sellers: string[] }> {
  const activeSellers = getActiveSellers();
  const aggregated = new Map<string, { totalQty: number; sellers: string[] }>();

  for (const seller of activeSellers) {
    for (const item of seller.inventory) {
      if (item.quantity > 0) {
        const existing = aggregated.get(item.blueprintId);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.sellers.push(seller.id);
        } else {
          aggregated.set(item.blueprintId, {
            totalQty: item.quantity,
            sellers: [seller.id],
          });
        }
      }
    }
  }

  return aggregated;
}

/**
 * Get all sellers that have a specific blueprint in stock
 */
export function getSellersWithBlueprint(blueprintId: string): SellerWithInventory[] {
  const activeSellers = getActiveSellers();
  return activeSellers.filter((seller) =>
    seller.inventory.some((item) => item.blueprintId === blueprintId && item.quantity > 0)
  );
}

/**
 * Get seller listings for a specific blueprint (for product page).
 * Returns all active sellers with stock, including price and quantity.
 * IMPORTANT: Sorted by sellerId ascending for deterministic round-robin ordering.
 * (No price sorting since prices are in different units and cannot be compared)
 */
export function getSellerListingsForBlueprint(blueprintId: string): SellerListing[] {
  const activeSellers = getActiveSellers();
  const listings: SellerListing[] = [];

  for (const seller of activeSellers) {
    const item = seller.inventory.find((i) => i.blueprintId === blueprintId);
    if (item && item.quantity > 0) {
      listings.push({
        sellerId: seller.id,
        sellerDiscordId: seller.discordId,
        quantity: item.quantity,
        price: normalizeItemPrice(item.price),
        publicNote: item.publicNote || null,
      });
    }
  }

  // Sort by sellerId ascending for deterministic ordering (fair round-robin)
  // This ensures consistent ordering for queue rotation
  listings.sort((a, b) => a.sellerId.localeCompare(b.sellerId));

  return listings;
}

/**
 * Get the count of sellers with inventory for a blueprint.
 * (Replaced getMinPriceForBlueprint since prices in different units cannot be compared)
 */
export function getSellerCountForBlueprint(blueprintId: string): number {
  const listings = getSellerListingsForBlueprint(blueprintId);
  return listings.length;
}

/**
 * Validate that a seller can fulfill a specific item request.
 * Returns error message if invalid, null if valid.
 */
export function validateSellerCanFulfill(
  sellerId: string,
  blueprintId: string,
  requestedQuantity: number
): string | null {
  const seller = getSellerById(sellerId);

  if (!seller) {
    return "Продавця не знайдено";
  }

  if (seller.status !== "active") {
    return "Продавець неактивний";
  }

  const item = seller.inventory.find((i) => i.blueprintId === blueprintId);

  if (!item || item.quantity <= 0) {
    return "Креслення немає в наявності";
  }

  if (item.quantity < requestedQuantity) {
    return `Недостатньо товару (є: ${item.quantity}, потрібно: ${requestedQuantity})`;
  }

  return null;
}

// ============================================
// ORDER RESOLUTION
// ============================================

/**
 * Check if an order REQUIRES multiple sellers to fulfill
 * Returns true ONLY if NO single active seller can fulfill ALL items
 *
 * An order requires multiple sellers when:
 * - There does NOT exist any single ACTIVE seller that can fulfill
 *   the entire order (all items with sufficient quantity)
 *
 * Examples:
 * - Single blueprint, multiple sellers have it -> returns false (any one seller can fulfill)
 * - 3 blueprints, one seller has all 3 -> returns false
 * - 3 blueprints, seller A has 2, seller B has 1, no one has all 3 -> returns true
 */
export function requiresMultipleSellers(
  items: { blueprintId: string; quantity: number }[]
): boolean {
  const activeSellers = getActiveSellers();

  // Check each active seller to see if they can fulfill the entire order
  for (const seller of activeSellers) {
    let canFulfillAll = true;

    for (const item of items) {
      const inventoryItem = seller.inventory.find(
        (i) => i.blueprintId === item.blueprintId
      );
      const availableQty = inventoryItem?.quantity || 0;

      if (availableQty < item.quantity) {
        // This seller cannot fulfill this item
        canFulfillAll = false;
        break;
      }
    }

    if (canFulfillAll) {
      // Found at least one seller who can fulfill the entire order
      return false;
    }
  }

  // No single seller can fulfill the entire order
  return true;
}

/**
 * Resolve which sellers have the requested blueprints
 * Returns grouped items by seller with availability info and prices
 */
export function resolveOrderToSellers(
  items: { blueprintId: string; blueprintName: string; quantity: number; sellerId?: string }[]
): {
  sellerId: string;
  sellerDiscordId: string;
  sellerTelegramChatId?: string;
  items: {
    blueprintId: string;
    blueprintName: string;
    requestedQty: number;
    available: boolean;
    availableQty: number;
    priceSnapshot?: ItemPrice;
  }[];
}[] {
  const activeSellers = getActiveSellers();
  const sellerGroups: Map<
    string,
    {
      sellerId: string;
      sellerDiscordId: string;
      sellerTelegramChatId?: string;
      items: {
        blueprintId: string;
        blueprintName: string;
        requestedQty: number;
        available: boolean;
        availableQty: number;
        priceSnapshot?: ItemPrice;
      }[];
    }
  > = new Map();

  for (const item of items) {
    // If a specific seller was requested, only check that seller
    const sellersToCheck = item.sellerId
      ? activeSellers.filter((s) => s.id === item.sellerId)
      : activeSellers;

    // Find all sellers that have this blueprint
    for (const seller of sellersToCheck) {
      const inventoryItem = seller.inventory.find((i) => i.blueprintId === item.blueprintId);
      const availableQty = inventoryItem?.quantity || 0;
      const priceSnapshot = normalizeItemPrice(inventoryItem?.price);

      if (availableQty > 0) {
        // This seller has this blueprint
        let group = sellerGroups.get(seller.id);
        if (!group) {
          group = {
            sellerId: seller.id,
            sellerDiscordId: seller.discordId,
            sellerTelegramChatId: seller.telegramChatId,
            items: [],
          };
          sellerGroups.set(seller.id, group);
        }

        group.items.push({
          blueprintId: item.blueprintId,
          blueprintName: item.blueprintName,
          requestedQty: item.quantity,
          available: availableQty >= item.quantity,
          availableQty,
          priceSnapshot,
        });
      }
    }
  }

  return Array.from(sellerGroups.values());
}

/**
 * Resolve order items to specific requested sellers.
 * Unlike resolveOrderToSellers which finds all sellers,
 * this validates that the requested sellers can fulfill the items.
 */
export function resolveOrderToRequestedSellers(
  items: { blueprintId: string; blueprintName: string; quantity: number; sellerId: string }[]
): {
  valid: boolean;
  error?: string;
  sellerGroups: {
    sellerId: string;
    sellerDiscordId: string;
    sellerTelegramChatId?: string;
    items: {
      blueprintId: string;
      blueprintName: string;
      requestedQty: number;
      available: boolean;
      availableQty: number;
      priceSnapshot: ItemPrice;
    }[];
  }[];
} {
  const sellerGroups: Map<
    string,
    {
      sellerId: string;
      sellerDiscordId: string;
      sellerTelegramChatId?: string;
      items: {
        blueprintId: string;
        blueprintName: string;
        requestedQty: number;
        available: boolean;
        availableQty: number;
        priceSnapshot: ItemPrice;
      }[];
    }
  > = new Map();

  // Validate each item against its requested seller
  for (const item of items) {
    const seller = getSellerById(item.sellerId);

    if (!seller) {
      return { valid: false, error: `Продавця не знайдено для "${item.blueprintName}"`, sellerGroups: [] };
    }

    if (seller.status !== "active") {
      return { valid: false, error: `Продавець "${seller.discordId}" неактивний`, sellerGroups: [] };
    }

    const inventoryItem = seller.inventory.find((i) => i.blueprintId === item.blueprintId);
    const availableQty = inventoryItem?.quantity || 0;
    const priceSnapshot = normalizeItemPrice(inventoryItem?.price);

    if (availableQty <= 0) {
      return {
        valid: false,
        error: `"${item.blueprintName}" немає в наявності у продавця ${seller.discordId}`,
        sellerGroups: [],
      };
    }

    if (availableQty < item.quantity) {
      return {
        valid: false,
        error: `Недостатньо "${item.blueprintName}" у продавця ${seller.discordId} (є: ${availableQty}, потрібно: ${item.quantity})`,
        sellerGroups: [],
      };
    }

    // Add to seller group
    let group = sellerGroups.get(seller.id);
    if (!group) {
      group = {
        sellerId: seller.id,
        sellerDiscordId: seller.discordId,
        sellerTelegramChatId: seller.telegramChatId,
        items: [],
      };
      sellerGroups.set(seller.id, group);
    }

    group.items.push({
      blueprintId: item.blueprintId,
      blueprintName: item.blueprintName,
      requestedQty: item.quantity,
      available: true,
      availableQty,
      priceSnapshot,
    });
  }

  return { valid: true, sellerGroups: Array.from(sellerGroups.values()) };
}

// ============================================
// SELLER QUEUE SYSTEM (Fair Round-Robin)
// ============================================

/**
 * Read the queue state from file
 */
function readQueueState(): QueueState {
  ensureDirectories();
  const state = safeReadJson<QueueState>(QUEUE_FILE);
  if (!state) {
    return { blueprints: {}, updatedAt: new Date().toISOString() };
  }
  return state;
}

/**
 * Write the queue state to file (uses atomic write)
 */
function writeQueueState(state: QueueState): void {
  safeWriteJson(QUEUE_FILE, state);
}

/**
 * Get the next eligible seller in round-robin order for a blueprint.
 *
 * Deterministic ordering: sellers are sorted by sellerId ascending.
 * The queue tracks lastSellerId and returns the next one in the sorted list.
 *
 * @param blueprintId - The blueprint to get next seller for
 * @param advanceQueue - If true, advances the queue pointer (default false for read-only)
 * @returns The next eligible seller or null if none available
 */
export async function getNextSellerInQueue(
  blueprintId: string,
  advanceQueue = false
): Promise<SellerListing | null> {
  // Get eligible sellers sorted by sellerId (deterministic ordering)
  const eligibleSellers = getSellerListingsForBlueprint(blueprintId);

  if (eligibleSellers.length === 0) {
    return null;
  }

  if (eligibleSellers.length === 1) {
    // Only one seller - always return them
    if (advanceQueue) {
      await updateQueuePointer(blueprintId, eligibleSellers[0].sellerId);
    }
    return eligibleSellers[0];
  }

  // Read queue state
  const queueState = readQueueState();
  const blueprintQueue = queueState.blueprints[blueprintId];
  const lastSellerId = blueprintQueue?.lastSellerId || null;

  // Find next seller after lastSellerId in sorted order
  let nextSeller: SellerListing;

  if (!lastSellerId) {
    // No previous assignment - return first seller
    nextSeller = eligibleSellers[0];
  } else {
    // Find index of last seller
    const lastIndex = eligibleSellers.findIndex(s => s.sellerId === lastSellerId);

    if (lastIndex < 0) {
      // Last seller no longer eligible - start from beginning
      nextSeller = eligibleSellers[0];
    } else {
      // Get next seller (wrap around to beginning if at end)
      const nextIndex = (lastIndex + 1) % eligibleSellers.length;
      nextSeller = eligibleSellers[nextIndex];
    }
  }

  // Advance queue if requested
  if (advanceQueue) {
    await updateQueuePointer(blueprintId, nextSeller.sellerId);
  }

  return nextSeller;
}

/**
 * Update the queue pointer for a blueprint.
 * Uses file locking to prevent race conditions.
 */
async function updateQueuePointer(blueprintId: string, sellerId: string): Promise<void> {
  return withFileLock(QUEUE_FILE, () => {
    const state = readQueueState();

    state.blueprints[blueprintId] = {
      blueprintId,
      lastSellerId: sellerId,
      updatedAt: new Date().toISOString(),
    };
    state.updatedAt = new Date().toISOString();

    writeQueueState(state);
  });
}

/**
 * Get seller listings with queue recommendation for a blueprint.
 * Returns the recommended (next in queue) seller and all eligible sellers.
 */
export async function getSellerListingsWithQueue(
  blueprintId: string,
  blueprintName: string,
  blueprintSlug: string,
  blueprintImage: string
): Promise<BlueprintSellersResponse> {
  const sellers = getSellerListingsForBlueprint(blueprintId);
  const recommendedSeller = await getNextSellerInQueue(blueprintId, false);

  return {
    blueprintId,
    blueprintName,
    blueprintSlug,
    blueprintImage,
    recommendedSeller,
    sellers,
  };
}

/**
 * Select a seller for an order and advance the queue if using recommended seller.
 *
 * @param blueprintId - The blueprint being ordered
 * @param requestedSellerId - Optional specific seller ID (if buyer chose manually)
 * @returns The selected seller or null if invalid
 */
export async function selectSellerForOrder(
  blueprintId: string,
  requestedSellerId?: string
): Promise<{ seller: SellerListing | null; usedQueue: boolean }> {
  const eligibleSellers = getSellerListingsForBlueprint(blueprintId);

  if (eligibleSellers.length === 0) {
    return { seller: null, usedQueue: false };
  }

  if (requestedSellerId) {
    // Buyer selected a specific seller - validate they are eligible
    const seller = eligibleSellers.find(s => s.sellerId === requestedSellerId);
    if (!seller) {
      return { seller: null, usedQueue: false };
    }
    // Do NOT advance queue when buyer manually selects
    return { seller, usedQueue: false };
  }

  // No specific seller requested - use queue to select recommended
  const seller = await getNextSellerInQueue(blueprintId, true);
  return { seller, usedQueue: true };
}

/**
 * Reset the queue pointer for a blueprint.
 * Useful for testing or admin actions.
 */
export async function resetBlueprintQueue(blueprintId: string): Promise<void> {
  return withFileLock(QUEUE_FILE, () => {
    const state = readQueueState();
    delete state.blueprints[blueprintId];
    state.updatedAt = new Date().toISOString();
    writeQueueState(state);
  });
}

/**
 * Get current queue state (for debugging/admin purposes)
 */
export function getQueueState(): QueueState {
  return readQueueState();
}

// ============================================
// PUBLIC SELLER PROFILE (Buyer-facing)
// ============================================

/**
 * Public seller profile - safe for display to buyers
 * Does NOT include passwordHash or other sensitive data
 */
export interface PublicSellerProfile {
  id: string;
  discordId: string;
  status: SellerStatus;
  createdAt: string;
  inventory: {
    blueprintId: string;
    quantity: number;
    price: ItemPrice;
    publicNote?: string | null;
  }[];
}

/**
 * Get a seller's public profile by ID (internal UUID or Discord ID).
 * Returns only public-safe data (no passwordHash).
 * Only returns data for ACTIVE sellers.
 */
export function getPublicSellerProfile(identifier: string): PublicSellerProfile | null {
  ensureDirectories();

  // Try to find by internal ID first
  let seller = getSellerById(identifier);

  // If not found, try by Discord ID
  if (!seller) {
    seller = getSellerByDiscordId(identifier);
  }

  if (!seller) {
    return null;
  }

  // Only return active sellers for public view
  if (seller.status !== "active") {
    return null;
  }

  // Filter inventory to only items with stock > 0
  const publicInventory = seller.inventory
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      blueprintId: item.blueprintId,
      quantity: item.quantity,
      price: normalizeItemPrice(item.price),
      publicNote: item.publicNote || null,
    }));

  return {
    id: seller.id,
    discordId: seller.discordId,
    status: seller.status,
    createdAt: seller.createdAt,
    inventory: publicInventory,
  };
}
