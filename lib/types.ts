// Blueprint categories
export const BLUEPRINT_TYPES = [
  "Guns",
  "Augments",
  "Utility",
  "Heals",
  "Grenades",
  "Attachments",
] as const;

export type BlueprintType = (typeof BLUEPRINT_TYPES)[number];

// Base blueprint (catalog definition - no ownership data)
export interface Blueprint {
  id: string;
  name: string;
  slug: string;
  image: string;
  type: BlueprintType;
  // Legacy fields - kept for backward compatibility during migration
  owned?: boolean;
  ownedQty?: number;
  notes?: string;
}

// ============================================
// SELLER SYSTEM TYPES
// ============================================

// Seller account status
export const SELLER_STATUSES = ["pending_verification", "active", "banned", "disabled"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

// Seller account (identified by Discord username/ID + password)
export interface Seller {
  id: string; // Unique internal ID (UUID)
  discordId: string; // Discord username or Discord ID (unique identifier)
  passwordHash: string; // Bcrypt hashed password (never stored in plaintext)
  status: SellerStatus; // Account status
  telegramChatId?: string; // Telegram chat ID for notifications
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Seller's inventory for a specific blueprint (quantity only)
export interface SellerInventoryItem {
  blueprintId: string; // References Blueprint.id
  quantity: number; // Available quantity (0 = not available)
}

// Seller with inventory data
export interface SellerWithInventory extends Seller {
  inventory: SellerInventoryItem[];
}

// User roles for access control
export const USER_ROLES = ["user", "seller", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Session data structure
export interface SessionData {
  role: UserRole;
  sellerId?: string; // Only for seller role
  expiresAt: number;
}

// Validate seller status
export function isValidSellerStatus(status: unknown): status is SellerStatus {
  return typeof status === "string" && SELLER_STATUSES.includes(status as SellerStatus);
}

// Check if seller can access dashboard (only active sellers)
export function canSellerAccessDashboard(seller: Seller): boolean {
  return seller.status === "active";
}

// Check if seller can modify inventory (only active sellers)
export function canSellerModifyInventory(seller: Seller): boolean {
  return seller.status === "active";
}

// Check if seller can receive orders (only active sellers)
export function canSellerReceiveOrders(seller: Seller): boolean {
  return seller.status === "active";
}

// Check if seller is pending verification
export function isSellerPendingVerification(seller: Seller): boolean {
  return seller.status === "pending_verification";
}

// Check if seller account is blocked (banned or disabled)
export function isSellerBlocked(seller: Seller): boolean {
  return seller.status === "banned" || seller.status === "disabled";
}

// Get human-readable status message for seller (Ukrainian)
export function getSellerStatusMessage(status: SellerStatus): string {
  switch (status) {
    case "pending_verification":
      return "Ваш обліковий запис очікує перевірки адміністратором.";
    case "active":
      return "Ваш обліковий запис активний.";
    case "banned":
      return "Ваш обліковий запис заблоковано.";
    case "disabled":
      return "Ваш обліковий запис вимкнено.";
    default:
      return "Невідомий статус облікового запису.";
  }
}

/**
 * Validate blueprint type
 */
export function isValidBlueprintType(type: unknown): type is BlueprintType {
  return typeof type === "string" && BLUEPRINT_TYPES.includes(type as BlueprintType);
}

/**
 * Validate and normalize ownedQty value
 * - Clamps to integer >= 0
 * - If owned=false, returns 0
 * - If owned=true and qty < 1, returns 1
 */
export function normalizeOwnedQty(owned: boolean, qty: unknown): number {
  // Parse to number, default to 0
  let value = typeof qty === "number" ? qty : parseInt(String(qty), 10);
  if (isNaN(value) || value < 0) {
    value = 0;
  }
  value = Math.floor(value);

  // If not owned, qty must be 0
  if (!owned) {
    return 0;
  }

  // If owned, qty must be at least 1
  if (value < 1) {
    return 1;
  }

  return value;
}

/**
 * Get the maximum selectable quantity for a blueprint
 */
export function getMaxSelectableQty(blueprint: Blueprint): number {
  return blueprint.owned ? (blueprint.ownedQty || 0) : 0;
}

// Selection with quantity for multi-select feature
export interface BlueprintSelection {
  blueprint: Blueprint;
  quantity: number;
}

// ============================================
// ORDER SYSTEM TYPES (Multi-seller support)
// ============================================

// Order item with seller resolution
export interface OrderItemWithSeller {
  blueprintId: string;
  blueprintName: string;
  quantity: number;
  sellerId: string;
  sellerDiscordId: string;
  available: boolean; // Based on seller's inventory
  availableQty: number; // How many the seller has
}

// Grouped order items by seller for notifications
export interface SellerOrderGroup {
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

// Order with resolved seller information
export interface ResolvedOrder {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  originalOffer: string; // Original offer from buyer (before multi-seller override)
  notes?: string;
  sellerGroups: SellerOrderGroup[];
  isMultiSeller: boolean; // True if order involves multiple sellers
  sellerCount: number; // Number of unique sellers
  createdAt: string;
}
