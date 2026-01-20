import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
  Seller,
  SellerStatus,
  SellerWithInventory,
  SellerInventoryItem,
  isValidSellerStatus,
} from "./types";
import { safeWriteJson, safeReadJson } from "./safe-file";

// Data directories
const DATA_DIR = path.join(process.cwd(), "data");
const SELLERS_DIR = path.join(DATA_DIR, "sellers");

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
 * Validate Discord ID format (Ukrainian messages)
 */
export function validateDiscordId(discordId: string): { valid: boolean; error?: string } {
  if (!discordId || typeof discordId !== "string") {
    return { valid: false, error: "Discord ID обов'язковий" };
  }

  const trimmed = discordId.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Discord ID не може бути порожнім" };
  }

  if (trimmed.length > 64) {
    return { valid: false, error: "Discord ID занадто довгий (макс. 64 символи)" };
  }

  return { valid: true };
}

/**
 * Register a new seller account
 * Creates account with PENDING_VERIFICATION status
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
    status: "pending_verification", // New accounts require admin verification
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
    status: "pending_verification", // Default: pending_verification until admin activates
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
 */
export async function setSellerPassword(
  sellerId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  // Validate password
  const validation = validatePassword(password);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const seller = getSellerById(sellerId);
  if (!seller) {
    return { success: false, error: "Seller not found" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  seller.passwordHash = passwordHash;
  seller.updatedAt = new Date().toISOString();

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return { success: true };
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
  return seller;
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
 * Get sellers pending verification
 */
export function getPendingVerificationSellers(): SellerWithInventory[] {
  return getAllSellers().filter((s) => s.status === "pending_verification");
}

/**
 * Update seller status
 */
export function updateSellerStatus(sellerId: string, status: SellerStatus): Seller | null {
  if (!isValidSellerStatus(status)) {
    throw new Error(`Invalid seller status: ${status}`);
  }

  const seller = getSellerById(sellerId);
  if (!seller) {
    return null;
  }

  seller.status = status;
  seller.updatedAt = new Date().toISOString();

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return seller;
}

/**
 * Update seller's Telegram chat ID
 */
export function updateSellerTelegramChatId(
  sellerId: string,
  telegramChatId: string | undefined
): Seller | null {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return null;
  }

  seller.telegramChatId = telegramChatId?.trim() || undefined;
  seller.updatedAt = new Date().toISOString();

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return seller;
}

/**
 * Update seller's Discord ID
 */
export function updateSellerDiscordId(sellerId: string, discordId: string): Seller | null {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return null;
  }

  // Check if new Discord ID is already taken by another seller
  const existing = getSellerByDiscordId(discordId);
  if (existing && existing.id !== sellerId) {
    throw new Error(`Discord ID "${discordId}" is already used by another seller`);
  }

  seller.discordId = discordId.trim();
  seller.updatedAt = new Date().toISOString();

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return seller;
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
 */
export function updateSellerInventoryItem(
  sellerId: string,
  blueprintId: string,
  quantity: number
): boolean {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return false;
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

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return true;
}

/**
 * Bulk update seller's inventory
 */
export function updateSellerInventoryBulk(
  sellerId: string,
  updates: { blueprintId: string; quantity: number }[]
): boolean {
  const seller = getSellerById(sellerId);
  if (!seller) {
    return false;
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

  const filePath = getSellerFilePath(sellerId);
  safeWriteJson(filePath, seller);

  return true;
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
 * Returns grouped items by seller with availability info
 */
export function resolveOrderToSellers(
  items: { blueprintId: string; blueprintName: string; quantity: number }[]
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
      }[];
    }
  > = new Map();

  for (const item of items) {
    // Find all sellers that have this blueprint
    for (const seller of activeSellers) {
      const inventoryItem = seller.inventory.find((i) => i.blueprintId === item.blueprintId);
      const availableQty = inventoryItem?.quantity || 0;

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
        });
      }
    }
  }

  return Array.from(sellerGroups.values());
}
