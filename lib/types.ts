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

// ============================================
// NEW PRICE SYSTEM - Materials/Blueprint Trade
// ============================================

// Price type options (exact values for UI and API)
export const PRICE_TYPES = [
  "Договірна",      // Negotiable
  "Пружини",        // Springs
  "Насіння",        // Seeds
  "Качки",          // Ducks
  "Інші матеріали", // Other materials (custom label)
  "Блюпринт(-и)",   // Blueprint trade
] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

// Material types that require amount
export const MATERIAL_PRICE_TYPES: PriceType[] = ["Пружини", "Насіння", "Качки"];

// Price amount validation constants
export const PRICE_AMOUNT_MIN = 1;
export const PRICE_AMOUNT_MAX = 999999;
export const TRADE_QTY_MIN = 1;
export const TRADE_QTY_MAX = 999;
export const TRADE_BLUEPRINTS_MAX = 10;
export const OTHER_LABEL_MAX_LENGTH = 40;

// Blueprint trade item (for "Блюпринт(-и)" price type)
export interface TradeBlueprintItem {
  blueprintId: string;  // Must match existing blueprint in catalog
  name?: string;        // Optional display name (do not trust as source of truth)
  qty: number;          // Quantity requested (1-999)
}

// New price structure for seller inventory
export interface ItemPrice {
  type: PriceType;
  amount?: number;                    // Required for material types (2-5)
  otherLabel?: string;                // Required if type === "Інші матеріали"
  tradeBlueprints?: TradeBlueprintItem[];  // Required if type === "Блюпринт(-и)"
}

// Legacy price constants (kept for backward compatibility during migration)
export const PRICE_MIN = 1; // Minimum price allowed (legacy)
export const PRICE_MAX = 999999; // Maximum price allowed (legacy)
export const PRICE_DEFAULT: number | null = null; // Default price when not set (legacy)

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

// Seller's inventory for a specific blueprint
export interface SellerInventoryItem {
  blueprintId: string; // References Blueprint.id
  quantity: number; // Available quantity (0 = not available)
  // New price structure (ItemPrice object)
  price?: ItemPrice | number | null; // ItemPrice object, or legacy number, or null/undefined
}

// Seller with inventory data
export interface SellerWithInventory extends Seller {
  inventory: SellerInventoryItem[];
}

// ============================================
// BUYER SYSTEM TYPES
// ============================================

// Buyer account (instant registration with password, no admin verification needed)
export interface Buyer {
  id: string;              // Unique internal ID (UUID)
  discordId: string;       // Discord username or Discord ID (unique identifier)
  passwordHash: string;    // Bcrypt hashed password (never stored in plaintext)
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}

// Discord ID (username) validation constants
export const DISCORD_ID_MIN_LENGTH = 2;
export const DISCORD_ID_MAX_LENGTH = 32;

// Regex for Discord username: letters, digits, underscore, dot, dash (2-32 chars)
export const DISCORD_ID_REGEX = /^[a-zA-Z0-9._-]{2,32}$/;

// Error message for invalid Discord ID (username)
export const DISCORD_ID_ERROR_MESSAGE = "Невірний Discord нік. Дозволені символи: літери, цифри, _, ., - (2–32 символи)";

/**
 * Validate Discord ID format (username-style: letters, numbers, _, ., -)
 * Backward compatible: also accepts legacy numeric IDs
 */
export function isValidDiscordId(discordId: unknown): boolean {
  if (typeof discordId !== "string") return false;
  const trimmed = discordId.trim();
  if (trimmed.length < DISCORD_ID_MIN_LENGTH || trimmed.length > DISCORD_ID_MAX_LENGTH) return false;
  // Accept username format OR legacy numeric format for backward compatibility
  return DISCORD_ID_REGEX.test(trimmed) || /^\d+$/.test(trimmed);
}

// User roles for access control
export const USER_ROLES = ["buyer", "seller", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ============================================
// UNIFIED USER SYSTEM
// ============================================

// Central user account (stores credentials and roles)
// This is the source of truth for authentication
export interface User {
  id: string;                   // Unique internal ID (UUID)
  discordId: string;            // Discord username (unique identifier)
  passwordHash: string;         // Bcrypt hashed password (never stored in plaintext)
  roles: UserRole[];            // Array of roles: ["buyer"], ["buyer", "seller"], etc.
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}

// Session data structure (extended to support multi-role)
export interface SessionData {
  role: UserRole;               // Current active role
  roles: UserRole[];            // All roles the user has
  userId: string;               // User ID from users store
  discordId: string;            // Discord ID for the user
  sellerId?: string;            // Seller profile ID (if user has seller role)
  buyerId?: string;             // Buyer profile ID (if user has buyer role)
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

// ============================================
// PRICE VALIDATION FUNCTIONS (New Material/Blueprint System)
// ============================================

/**
 * Check if a price type is valid
 */
export function isValidPriceType(type: unknown): type is PriceType {
  return typeof type === "string" && PRICE_TYPES.includes(type as PriceType);
}

/**
 * Check if price type requires amount field
 */
export function priceTypeRequiresAmount(type: PriceType): boolean {
  return MATERIAL_PRICE_TYPES.includes(type) || type === "Інші матеріали";
}

/**
 * Validate the new ItemPrice structure
 * @param price - The price object to validate
 * @param validBlueprintIds - Set of valid blueprint IDs from catalog (for trade validation)
 * @returns Object with valid flag and optional error message
 */
export function validateItemPrice(
  price: unknown,
  validBlueprintIds?: Set<string>
): { valid: boolean; error?: string } {
  // Allow null/undefined (means "not set" -> defaults to Договірна)
  if (price === null || price === undefined) {
    return { valid: true };
  }

  // Handle legacy numeric price (backward compatibility)
  if (typeof price === "number") {
    // Legacy numeric prices are valid but will be converted to Договірна on write
    return { valid: true };
  }

  // Must be an object
  if (typeof price !== "object") {
    return { valid: false, error: "Невірний формат ціни" };
  }

  const p = price as Record<string, unknown>;

  // Type is required
  if (!p.type || !isValidPriceType(p.type)) {
    return { valid: false, error: "Невірний тип ціни" };
  }

  const priceType = p.type as PriceType;

  // Validate based on type
  switch (priceType) {
    case "Договірна":
      // No additional fields required
      if (p.amount !== undefined && p.amount !== null) {
        return { valid: false, error: "Для типу 'Договірна' кількість не потрібна" };
      }
      if (p.otherLabel) {
        return { valid: false, error: "Для типу 'Договірна' мітка не потрібна" };
      }
      if (p.tradeBlueprints && Array.isArray(p.tradeBlueprints) && p.tradeBlueprints.length > 0) {
        return { valid: false, error: "Для типу 'Договірна' список обміну не потрібен" };
      }
      break;

    case "Пружини":
    case "Насіння":
    case "Качки":
      // Amount required
      if (p.amount === undefined || p.amount === null) {
        return { valid: false, error: "Вкажіть кількість матеріалів" };
      }
      if (typeof p.amount !== "number" || !Number.isInteger(p.amount)) {
        return { valid: false, error: "Кількість має бути цілим числом" };
      }
      if (p.amount < PRICE_AMOUNT_MIN || p.amount > PRICE_AMOUNT_MAX) {
        return { valid: false, error: `Кількість має бути від ${PRICE_AMOUNT_MIN} до ${PRICE_AMOUNT_MAX}` };
      }
      if (p.otherLabel) {
        return { valid: false, error: `Для типу '${priceType}' мітка не потрібна` };
      }
      if (p.tradeBlueprints && Array.isArray(p.tradeBlueprints) && p.tradeBlueprints.length > 0) {
        return { valid: false, error: `Для типу '${priceType}' список обміну не потрібен` };
      }
      break;

    case "Інші матеріали":
      // Both otherLabel and amount required
      if (!p.otherLabel || typeof p.otherLabel !== "string") {
        return { valid: false, error: "Вкажіть назву матеріалу" };
      }
      const label = (p.otherLabel as string).trim();
      if (label.length === 0) {
        return { valid: false, error: "Назва матеріалу не може бути порожньою" };
      }
      if (label.length > OTHER_LABEL_MAX_LENGTH) {
        return { valid: false, error: `Назва матеріалу занадто довга (макс. ${OTHER_LABEL_MAX_LENGTH} символів)` };
      }
      if (p.amount === undefined || p.amount === null) {
        return { valid: false, error: "Вкажіть кількість матеріалів" };
      }
      if (typeof p.amount !== "number" || !Number.isInteger(p.amount)) {
        return { valid: false, error: "Кількість має бути цілим числом" };
      }
      if (p.amount < PRICE_AMOUNT_MIN || p.amount > PRICE_AMOUNT_MAX) {
        return { valid: false, error: `Кількість має бути від ${PRICE_AMOUNT_MIN} до ${PRICE_AMOUNT_MAX}` };
      }
      if (p.tradeBlueprints && Array.isArray(p.tradeBlueprints) && p.tradeBlueprints.length > 0) {
        return { valid: false, error: "Для типу 'Інші матеріали' список обміну не потрібен" };
      }
      break;

    case "Блюпринт(-и)":
      // tradeBlueprints required
      if (!p.tradeBlueprints || !Array.isArray(p.tradeBlueprints)) {
        return { valid: false, error: "Вкажіть креслення для обміну" };
      }
      if (p.tradeBlueprints.length === 0) {
        return { valid: false, error: "Список обміну не може бути порожнім" };
      }
      if (p.tradeBlueprints.length > TRADE_BLUEPRINTS_MAX) {
        return { valid: false, error: `Занадто багато креслень (макс. ${TRADE_BLUEPRINTS_MAX})` };
      }

      // Validate each trade item
      const seenIds = new Set<string>();
      for (let i = 0; i < p.tradeBlueprints.length; i++) {
        const item = p.tradeBlueprints[i] as Record<string, unknown>;
        if (!item || typeof item !== "object") {
          return { valid: false, error: `Невірний елемент обміну #${i + 1}` };
        }
        if (!item.blueprintId || typeof item.blueprintId !== "string") {
          return { valid: false, error: `Відсутній ID креслення в елементі #${i + 1}` };
        }
        // Check for duplicates
        if (seenIds.has(item.blueprintId as string)) {
          return { valid: false, error: `Дублікат креслення в списку обміну` };
        }
        seenIds.add(item.blueprintId as string);

        // Validate against catalog if provided
        if (validBlueprintIds && !validBlueprintIds.has(item.blueprintId as string)) {
          return { valid: false, error: `Невідоме креслення: ${item.blueprintId}` };
        }

        // Validate qty
        if (item.qty === undefined || item.qty === null) {
          return { valid: false, error: `Вкажіть кількість для креслення #${i + 1}` };
        }
        if (typeof item.qty !== "number" || !Number.isInteger(item.qty)) {
          return { valid: false, error: `Кількість має бути цілим числом (елемент #${i + 1})` };
        }
        if (item.qty < TRADE_QTY_MIN || item.qty > TRADE_QTY_MAX) {
          return { valid: false, error: `Кількість має бути від ${TRADE_QTY_MIN} до ${TRADE_QTY_MAX} (елемент #${i + 1})` };
        }
      }

      if (p.amount !== undefined && p.amount !== null) {
        return { valid: false, error: "Для типу 'Блюпринт(-и)' кількість матеріалів не потрібна" };
      }
      if (p.otherLabel) {
        return { valid: false, error: "Для типу 'Блюпринт(-и)' мітка не потрібна" };
      }
      break;
  }

  return { valid: true };
}

/**
 * Normalize price to new ItemPrice structure.
 * Handles backward compatibility with legacy numeric prices.
 */
export function normalizeItemPrice(price: unknown): ItemPrice {
  // Default to Договірна for null/undefined
  if (price === null || price === undefined) {
    return { type: "Договірна" };
  }

  // Legacy numeric price -> convert to Договірна
  if (typeof price === "number") {
    return { type: "Договірна" };
  }

  // Already an ItemPrice object
  if (typeof price === "object") {
    const p = price as Record<string, unknown>;

    // Validate type
    if (!p.type || !isValidPriceType(p.type)) {
      return { type: "Договірна" };
    }

    const result: ItemPrice = { type: p.type as PriceType };

    // Add type-specific fields
    if (priceTypeRequiresAmount(result.type) && typeof p.amount === "number") {
      result.amount = Math.floor(Math.max(PRICE_AMOUNT_MIN, Math.min(PRICE_AMOUNT_MAX, p.amount)));
    }

    if (result.type === "Інші матеріали" && typeof p.otherLabel === "string") {
      result.otherLabel = p.otherLabel.trim().substring(0, OTHER_LABEL_MAX_LENGTH);
    }

    if (result.type === "Блюпринт(-и)" && Array.isArray(p.tradeBlueprints)) {
      // Merge duplicates and normalize
      const merged = new Map<string, TradeBlueprintItem>();
      for (const item of p.tradeBlueprints) {
        if (item && typeof item === "object" && item.blueprintId) {
          const id = String(item.blueprintId);
          const existing = merged.get(id);
          const qty = Math.floor(Math.max(TRADE_QTY_MIN, Math.min(TRADE_QTY_MAX, Number(item.qty) || 1)));
          if (existing) {
            existing.qty = Math.min(TRADE_QTY_MAX, existing.qty + qty);
          } else {
            merged.set(id, {
              blueprintId: id,
              name: typeof item.name === "string" ? item.name : undefined,
              qty,
            });
          }
        }
      }
      result.tradeBlueprints = Array.from(merged.values()).slice(0, TRADE_BLUEPRINTS_MAX);
    }

    return result;
  }

  // Unknown format -> default to Договірна
  return { type: "Договірна" };
}

/**
 * Format ItemPrice for display in UI.
 */
export function formatItemPrice(price: ItemPrice | number | null | undefined, fallback = "Договірна"): string {
  if (price === null || price === undefined) {
    return fallback;
  }

  // Legacy numeric price
  if (typeof price === "number") {
    return fallback;
  }

  switch (price.type) {
    case "Договірна":
      return "Договірна";

    case "Пружини":
    case "Насіння":
    case "Качки":
      return `${price.amount || 0} ${price.type}`;

    case "Інші матеріали":
      return `${price.amount || 0} ${price.otherLabel || "матеріалів"}`;

    case "Блюпринт(-и)":
      if (!price.tradeBlueprints || price.tradeBlueprints.length === 0) {
        return "Обмін на креслення";
      }
      const items = price.tradeBlueprints
        .map(t => `${t.name || t.blueprintId} x${t.qty}`)
        .join(", ");
      return `Обмін на: ${items}`;

    default:
      return fallback;
  }
}

/**
 * Check if price is a trade (blueprint exchange) type
 */
export function isPriceTradeType(price: ItemPrice | number | null | undefined): boolean {
  if (!price || typeof price === "number") return false;
  return price.type === "Блюпринт(-и)";
}

/**
 * Get price for comparison/sorting (returns null for non-comparable types)
 * Note: Different material types cannot be compared, so this returns null for most cases
 */
export function getPriceComparisonValue(price: ItemPrice | number | null | undefined): number | null {
  // Prices in different units cannot be meaningfully compared
  // This function is kept for potential future use but returns null
  return null;
}

// Legacy validation function (kept for backward compatibility)
export function validatePrice(price: unknown): { valid: boolean; error?: string } {
  // Allow null/undefined (means "not set")
  if (price === null || price === undefined) {
    return { valid: true };
  }

  // Handle new ItemPrice objects
  if (typeof price === "object") {
    return validateItemPrice(price);
  }

  // Legacy numeric validation (for backward compatibility during transition)
  if (typeof price !== "number") {
    return { valid: false, error: "Ціна має бути числом або об'єктом" };
  }

  if (isNaN(price) || price < 0) {
    return { valid: false, error: "Недійсне значення ціни" };
  }

  return { valid: true };
}

// Legacy normalize function (kept for backward compatibility)
export function normalizePrice(price: unknown): number | null {
  if (price === null || price === undefined || price === "") {
    return null;
  }

  const numPrice = typeof price === "number" ? price : parseInt(String(price), 10);

  if (isNaN(numPrice) || numPrice <= 0) {
    return null;
  }

  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.floor(numPrice)));
}

// Legacy format function (kept for backward compatibility)
export function formatPrice(price: number | null | undefined, fallback = "Ціна не вказана"): string {
  if (price === null || price === undefined) {
    return fallback;
  }
  return `${price}`;
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

// Selection with quantity for multi-select feature (legacy - no seller selection)
export interface BlueprintSelection {
  blueprint: Blueprint;
  quantity: number;
}

// Selection with seller for new checkout flow
export interface BlueprintSelectionWithSeller {
  blueprint: Blueprint;
  quantity: number;
  sellerId: string;
  sellerDiscordId: string;
  priceSnapshot: ItemPrice; // Full price object snapshot at time of selection
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
  unitPrice: number | null; // Seller's price per unit at time of order
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
    priceSnapshot?: ItemPrice; // Seller's price at time of order
  }[];
}

// Cart item - tracks selected blueprint with specific seller
export interface CartItem {
  id: string;            // Unique cart item ID (for splitting same blueprint across sellers)
  blueprintId: string;
  blueprintName: string;
  blueprintSlug: string;
  blueprintImage: string;
  blueprintType: BlueprintType;
  sellerId: string;
  sellerDiscordId: string;
  quantity: number;
  priceSnapshot: ItemPrice; // Full price object snapshot at time of adding to cart
  buyerOfferText?: string;  // Per-item offer (required for negotiable, optional for others)
}

// Seller listing for product page - shows all sellers with stock
export interface SellerListing {
  sellerId: string;
  sellerDiscordId: string;
  quantity: number;
  price: ItemPrice; // Full price object
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
  // New: order type for trade orders
  orderType?: "standard" | "trade_pending";
}

// ============================================
// SELLER QUEUE SYSTEM (Fair Round-Robin)
// ============================================

// Queue state for a single blueprint
export interface BlueprintQueueState {
  blueprintId: string;
  lastSellerId: string | null; // Last seller assigned via queue
  updatedAt: string; // ISO timestamp
}

// Full queue state storage
export interface QueueState {
  blueprints: Record<string, BlueprintQueueState>;
  updatedAt: string;
}

// Seller listing with queue recommendation
export interface SellerListingWithQueue extends SellerListing {
  isRecommended: boolean; // True if this is the next seller in queue
}

// Response for GET /blueprints/:id/sellers
export interface BlueprintSellersResponse {
  blueprintId: string;
  blueprintName: string;
  blueprintSlug: string;
  blueprintImage: string;
  recommendedSeller: SellerListing | null;
  sellers: SellerListing[];
}
