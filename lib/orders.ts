/**
 * Order storage, claiming, and lifecycle management for seller dashboard
 * Orders are stored with seller links and claim tracking for efficient querying
 */

import fs from "fs";
import path from "path";
import { safeWriteJson, safeReadJson, withFileLock } from "./safe-file";
import { ProcessedOrder } from "./order";
import { getSellerById, getSellerBlueprintQuantity, updateSellerInventoryItem } from "./sellers";
import { canSellerReceiveOrders } from "./types";

// Data directory for orders
const DATA_DIR = path.join(process.cwd(), "data");
const ORDERS_DIR = path.join(DATA_DIR, "orders");

// ============================================
// ORDER STATUS TYPES
// ============================================

export type OrderStatus = "open" | "in_progress" | "completed" | "closed" | "cancelled";

export type ItemClaimStatus = "unclaimed" | "claimed" | "fulfilled";

// Per-seller state for tracking individual seller closure
export type SellerOrderStatus = "active" | "closed";

export interface SellerOrderState {
  sellerId: string;
  status: SellerOrderStatus;
  closedAt?: string;
}

// Item-level claim information
export interface OrderItemClaim {
  blueprintId: string;
  blueprintName: string;
  requestedQty: number;
  // Claim fields
  claimStatus: ItemClaimStatus;
  claimedBySellerId?: string;
  claimedBySellerDiscordId?: string;
  claimedQuantity?: number;
  claimedAt?: string;
  fulfilledAt?: string;
}

// Stored order extends ProcessedOrder with claim tracking
export interface StoredOrder extends ProcessedOrder {
  // Array of seller IDs that are linked to this order (can fulfill items)
  sellerIds: string[];
  // Order-level status (global - only "closed" when ALL items fulfilled or admin closes)
  status: OrderStatus;
  // Seller assigned to entire order (if full accept)
  assignedSellerId?: string;
  assignedSellerDiscordId?: string;
  assignedAt?: string;
  // Item-level claims
  itemClaims: OrderItemClaim[];
  // Per-seller states (for seller-scoped closure)
  sellerStates?: SellerOrderState[];
  // Lifecycle timestamps (for global close)
  closedAt?: string;
  closedBySellerId?: string;
}

// Order view for seller (filtered to only their unclaimed/claimable items)
export interface SellerOrderView {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  notes?: string;
  isMultiSeller: boolean;
  createdAt: string;
  status: OrderStatus;
  // Is this order assigned to this seller?
  isAssignedToMe: boolean;
  // Has THIS seller closed/archived this order for themselves?
  isClosedByMe: boolean;
  // Only items relevant to this seller (unclaimed or claimed by them)
  items: {
    blueprintId: string;
    blueprintName: string;
    requestedQty: number;
    available: boolean;
    availableQty: number;
    // Claim info
    claimStatus: ItemClaimStatus;
    claimedByMe: boolean;
    claimedBySellerId?: string;
    claimedBySellerDiscordId?: string;
    claimedQuantity?: number;
  }[];
  // Summary
  canAcceptFull: boolean;  // Can this seller accept the entire order?
  claimableItemCount: number;  // How many items can this seller claim?
  myClaimedItemCount: number;  // How many items has this seller claimed?
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_DIR)) {
    fs.mkdirSync(ORDERS_DIR, { recursive: true });
  }
}

function getOrderFilePath(orderId: string): string {
  const safeId = orderId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(ORDERS_DIR, `${safeId}.json`);
}

/**
 * Migrate old order format to new format with claims
 */
function migrateOrderIfNeeded(order: StoredOrder): StoredOrder {
  // Add status if missing
  if (!order.status) {
    order.status = "open";
  }

  // Add itemClaims if missing
  if (!order.itemClaims) {
    order.itemClaims = [];

    // Initialize item claims from seller groups
    for (const group of order.sellerGroups) {
      for (const item of group.items) {
        // Check if this item already exists in claims
        const existingClaim = order.itemClaims.find(
          (c) => c.blueprintId === item.blueprintId
        );

        if (!existingClaim) {
          order.itemClaims.push({
            blueprintId: item.blueprintId,
            blueprintName: item.blueprintName,
            requestedQty: item.requestedQty,
            claimStatus: "unclaimed",
          });
        }
      }
    }
  }

  return order;
}

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

/**
 * Save a processed order to storage
 * Initializes claim tracking for all items
 */
export function saveOrder(processedOrder: ProcessedOrder): StoredOrder {
  ensureDirectories();

  // Extract unique seller IDs from seller groups
  const sellerIds = processedOrder.sellerGroups.map((group) => group.sellerId);

  // Initialize item claims from all unique items across seller groups
  const itemClaimsMap = new Map<string, OrderItemClaim>();

  for (const group of processedOrder.sellerGroups) {
    for (const item of group.items) {
      if (!itemClaimsMap.has(item.blueprintId)) {
        itemClaimsMap.set(item.blueprintId, {
          blueprintId: item.blueprintId,
          blueprintName: item.blueprintName,
          requestedQty: item.requestedQty,
          claimStatus: "unclaimed",
        });
      }
    }
  }

  const storedOrder: StoredOrder = {
    ...processedOrder,
    sellerIds,
    status: "open",
    itemClaims: Array.from(itemClaimsMap.values()),
  };

  const filePath = getOrderFilePath(processedOrder.orderId);
  safeWriteJson(filePath, storedOrder);

  return storedOrder;
}

/**
 * Get order by ID (with migration)
 */
export function getOrderById(orderId: string): StoredOrder | null {
  ensureDirectories();
  const filePath = getOrderFilePath(orderId);
  const order = safeReadJson<StoredOrder>(filePath);
  if (order) {
    return migrateOrderIfNeeded(order);
  }
  return null;
}

/**
 * Get all stored orders (with migration)
 */
export function getAllOrders(): StoredOrder[] {
  ensureDirectories();

  if (!fs.existsSync(ORDERS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith(".json"));
  const orders: StoredOrder[] = [];

  for (const file of files) {
    const filePath = path.join(ORDERS_DIR, file);
    const order = safeReadJson<StoredOrder>(filePath);
    if (order && order.orderId) {
      orders.push(migrateOrderIfNeeded(order));
    }
  }

  // Sort by createdAt descending (newest first)
  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Update order in storage
 */
function updateOrder(order: StoredOrder): void {
  const filePath = getOrderFilePath(order.orderId);
  safeWriteJson(filePath, order);
}

// ============================================
// SELLER ORDER VIEWS
// ============================================

/**
 * Helper to check if seller has closed this order for themselves
 */
function isOrderClosedBySeller(order: StoredOrder, sellerId: string): boolean {
  if (!order.sellerStates) return false;
  const sellerState = order.sellerStates.find(s => s.sellerId === sellerId);
  return sellerState?.status === "closed";
}

/**
 * Get orders for a specific seller
 * Returns orders where:
 * - Order is not globally closed/cancelled
 * - Order is not closed by THIS seller (per-seller closure)
 * - Order is not assigned to another seller
 * - Seller has at least one unclaimed item OR has claimed items
 */
export function getOrdersForSeller(sellerId: string): SellerOrderView[] {
  const allOrders = getAllOrders();
  const sellerOrders: SellerOrderView[] = [];

  // Verify seller exists and can receive orders
  const seller = getSellerById(sellerId);
  if (!seller || !canSellerReceiveOrders(seller)) {
    return [];
  }

  for (const order of allOrders) {
    // Skip globally closed/cancelled orders (they go to archived view)
    if (order.status === "closed" || order.status === "cancelled") {
      continue;
    }

    // Skip orders that THIS seller has closed for themselves
    if (isOrderClosedBySeller(order, sellerId)) {
      continue;
    }

    // Skip orders assigned to other sellers
    if (order.assignedSellerId && order.assignedSellerId !== sellerId) {
      continue;
    }

    // Check if this seller can see this order
    const sellerView = buildSellerOrderView(order, sellerId, seller.discordId);

    if (sellerView) {
      sellerOrders.push(sellerView);
    }
  }

  return sellerOrders;
}

/**
 * Get archived (closed/cancelled) orders for a seller
 * Includes:
 * - Globally closed/cancelled orders where seller had claimed items
 * - Orders that THIS seller has closed for themselves (per-seller closure)
 */
export function getArchivedOrdersForSeller(sellerId: string): SellerOrderView[] {
  const allOrders = getAllOrders();
  const archivedOrders: SellerOrderView[] = [];

  const seller = getSellerById(sellerId);
  if (!seller || !canSellerReceiveOrders(seller)) {
    return [];
  }

  for (const order of allOrders) {
    const isGloballyClosed = order.status === "closed" || order.status === "cancelled";
    const isClosedByThisSeller = isOrderClosedBySeller(order, sellerId);

    // Show in archived if:
    // 1. Order is globally closed/cancelled AND seller had involvement, OR
    // 2. This seller has closed the order for themselves

    const hasClaimedItems = order.itemClaims.some(
      (claim) => claim.claimedBySellerId === sellerId
    );
    const wasAssigned = order.assignedSellerId === sellerId;
    const hadInvolvement = hasClaimedItems || wasAssigned;

    // Skip if not archived for this seller
    if (!isGloballyClosed && !isClosedByThisSeller) {
      continue;
    }

    // For globally closed orders, only show if seller had involvement
    if (isGloballyClosed && !hadInvolvement) {
      continue;
    }

    // For per-seller closed orders, always show (they closed it themselves)
    // Note: isClosedByThisSeller implies they had involvement

    const sellerView = buildSellerOrderView(order, sellerId, seller.discordId);
    if (sellerView) {
      archivedOrders.push(sellerView);
    }
  }

  return archivedOrders;
}

/**
 * Build seller-specific view of an order
 *
 * Visibility Rules:
 * - Seller sees items they have CLAIMED (regardless of current inventory)
 * - Seller sees UNCLAIMED items ONLY if they have inventory > 0
 * - Seller does NOT see unclaimed items where they have 0 inventory
 * - Seller does NOT see items claimed by OTHER sellers (unless assigned to full order)
 * - If seller has no visible items, the entire order is hidden (returns null)
 *
 * This prevents "unactionable" orders where seller has 0 stock for all items.
 */
function buildSellerOrderView(
  order: StoredOrder,
  sellerId: string,
  sellerDiscordId: string
): SellerOrderView | null {
  const isAssignedToMe = order.assignedSellerId === sellerId;
  const isClosedByMe = isOrderClosedBySeller(order, sellerId);

  // Build items list with claim info
  const items: SellerOrderView["items"] = [];
  let claimableItemCount = 0;
  let myClaimedItemCount = 0;
  let canAcceptAll = true;

  for (const claim of order.itemClaims) {
    // Check if this item is claimable by this seller
    const sellerQty = getSellerBlueprintQuantity(sellerId, claim.blueprintId);
    const available = sellerQty >= claim.requestedQty;

    // Determine if seller can see/interact with this item
    const isClaimedByMe = claim.claimedBySellerId === sellerId;
    const isUnclaimed = claim.claimStatus === "unclaimed";

    // For unclaimed items: seller can only see if they have inventory (> 0)
    // This prevents showing "unactionable" orders to sellers with 0 stock
    const canSeeUnclaimed = isUnclaimed && sellerQty > 0;
    const canSee = isClaimedByMe || canSeeUnclaimed || isAssignedToMe;

    if (!canSee) {
      // Item is claimed by another seller OR seller has no inventory for unclaimed item
      if (isUnclaimed) {
        // Seller can't claim this item - they have 0 quantity
        canAcceptAll = false;
      }
      continue;
    }

    if (isUnclaimed && sellerQty > 0) {
      claimableItemCount++;
    }

    if (isClaimedByMe) {
      myClaimedItemCount++;
    }

    // Check if seller can fulfill this item (has enough quantity)
    if (isUnclaimed && sellerQty < claim.requestedQty) {
      canAcceptAll = false;
    }

    items.push({
      blueprintId: claim.blueprintId,
      blueprintName: claim.blueprintName,
      requestedQty: claim.requestedQty,
      available,
      availableQty: sellerQty,
      claimStatus: claim.claimStatus,
      claimedByMe: isClaimedByMe,
      claimedBySellerId: claim.claimedBySellerId,
      claimedBySellerDiscordId: claim.claimedBySellerDiscordId,
      claimedQuantity: claim.claimedQuantity,
    });
  }

  // Don't show order if no visible items
  if (items.length === 0) {
    return null;
  }

  // Can accept full only if all items are unclaimed and seller has inventory
  const allUnclaimed = order.itemClaims.every((c) => c.claimStatus === "unclaimed");
  canAcceptAll = canAcceptAll && allUnclaimed && items.length === order.itemClaims.length;

  return {
    orderId: order.orderId,
    buyerDiscordNick: order.buyerDiscordNick,
    offer: order.offer,
    notes: order.notes,
    isMultiSeller: order.isMultiSeller,
    createdAt: order.createdAt,
    status: order.status,
    isAssignedToMe,
    isClosedByMe,
    items,
    canAcceptFull: canAcceptAll,
    claimableItemCount,
    myClaimedItemCount,
  };
}

/**
 * Get specific order for seller by ID
 */
export function getOrderForSeller(
  orderId: string,
  sellerId: string
): SellerOrderView | null {
  const order = getOrderById(orderId);
  if (!order) {
    return null;
  }

  const seller = getSellerById(sellerId);
  if (!seller || !canSellerReceiveOrders(seller)) {
    return null;
  }

  return buildSellerOrderView(order, sellerId, seller.discordId);
}

// ============================================
// CLAIM OPERATIONS (with file locking)
// ============================================

export interface ClaimResult {
  success: boolean;
  error?: string;
  claimedItems?: string[];
}

/**
 * Accept entire order (full claim)
 * Seller takes responsibility for all items
 * Other sellers will no longer see this order
 */
export async function acceptOrderFull(
  orderId: string,
  sellerId: string
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    // Check order status
    if (order.status === "closed" || order.status === "cancelled") {
      return { success: false, error: "Замовлення вже закрите" };
    }

    // Check if already assigned
    if (order.assignedSellerId && order.assignedSellerId !== sellerId) {
      return { success: false, error: "Замовлення вже прийняте іншим продавцем" };
    }

    // Verify seller
    const seller = getSellerById(sellerId);
    if (!seller || !canSellerReceiveOrders(seller)) {
      return { success: false, error: "У вас немає дозволу приймати замовлення" };
    }

    // Check if all items are claimable by this seller
    const claimedItems: string[] = [];

    for (const claim of order.itemClaims) {
      // Check if item is already claimed by someone else
      if (claim.claimStatus !== "unclaimed" && claim.claimedBySellerId !== sellerId) {
        return {
          success: false,
          error: `Позиція "${claim.blueprintName}" вже прийнята іншим продавцем`
        };
      }

      // Check if seller has enough inventory
      const sellerQty = getSellerBlueprintQuantity(sellerId, claim.blueprintId);
      if (sellerQty < claim.requestedQty) {
        return {
          success: false,
          error: `Недостатньо "${claim.blueprintName}" в інвентарі (є ${sellerQty}, потрібно ${claim.requestedQty})`,
        };
      }

      claimedItems.push(claim.blueprintId);
    }

    // All checks passed - assign order and claim all items
    const now = new Date().toISOString();

    order.assignedSellerId = sellerId;
    order.assignedSellerDiscordId = seller.discordId;
    order.assignedAt = now;
    order.status = "in_progress";

    for (const claim of order.itemClaims) {
      claim.claimStatus = "claimed";
      claim.claimedBySellerId = sellerId;
      claim.claimedBySellerDiscordId = seller.discordId;
      claim.claimedQuantity = claim.requestedQty;
      claim.claimedAt = now;
    }

    updateOrder(order);

    return { success: true, claimedItems };
  });
}

/**
 * Claim specific items (partial claim)
 * Seller claims only items they can fulfill
 */
export async function claimOrderItems(
  orderId: string,
  sellerId: string,
  blueprintIds?: string[]  // If not provided, claim all claimable items
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    // Check order status
    if (order.status === "closed" || order.status === "cancelled") {
      return { success: false, error: "Замовлення вже закрите" };
    }

    // If order is assigned to another seller, can't claim
    if (order.assignedSellerId && order.assignedSellerId !== sellerId) {
      return { success: false, error: "Замовлення вже прийняте іншим продавцем" };
    }

    // Verify seller
    const seller = getSellerById(sellerId);
    if (!seller || !canSellerReceiveOrders(seller)) {
      return { success: false, error: "У вас немає дозволу приймати замовлення" };
    }

    // Determine which items to claim
    const itemsToClaim = blueprintIds || order.itemClaims
      .filter((c) => c.claimStatus === "unclaimed")
      .map((c) => c.blueprintId);

    const claimedItems: string[] = [];
    const now = new Date().toISOString();

    for (const blueprintId of itemsToClaim) {
      const claim = order.itemClaims.find((c) => c.blueprintId === blueprintId);
      if (!claim) {
        continue;
      }

      // Skip if already claimed by someone else
      if (claim.claimStatus !== "unclaimed" && claim.claimedBySellerId !== sellerId) {
        continue;
      }

      // Check if seller has inventory for this item
      const sellerQty = getSellerBlueprintQuantity(sellerId, claim.blueprintId);
      if (sellerQty < claim.requestedQty) {
        continue;  // Skip items seller can't fulfill
      }

      // Claim this item
      claim.claimStatus = "claimed";
      claim.claimedBySellerId = sellerId;
      claim.claimedBySellerDiscordId = seller.discordId;
      claim.claimedQuantity = claim.requestedQty;
      claim.claimedAt = now;

      claimedItems.push(blueprintId);
    }

    if (claimedItems.length === 0) {
      return { success: false, error: "Немає позицій для прийняття" };
    }

    // Update order status
    if (order.status === "open") {
      order.status = "in_progress";
    }

    updateOrder(order);

    return { success: true, claimedItems };
  });
}

/**
 * Mark claimed item as fulfilled and decrease seller inventory
 * Idempotency: Once fulfilled, cannot be fulfilled again (prevents double decrement)
 */
export async function fulfillOrderItem(
  orderId: string,
  sellerId: string,
  blueprintId: string
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    const claim = order.itemClaims.find((c) => c.blueprintId === blueprintId);
    if (!claim) {
      return { success: false, error: "Позицію не знайдено" };
    }

    // Can only fulfill own claimed items
    if (claim.claimedBySellerId !== sellerId) {
      return { success: false, error: "Ви не можете виконати цю позицію" };
    }

    // Idempotency check: already fulfilled = no double decrement
    if (claim.claimStatus === "fulfilled") {
      return { success: false, error: "Позиція вже виконана" };
    }

    // Check seller has sufficient inventory before fulfillment
    const currentQty = getSellerBlueprintQuantity(sellerId, blueprintId);
    const quantityToFulfill = claim.claimedQuantity || claim.requestedQty;

    if (currentQty < quantityToFulfill) {
      return {
        success: false,
        error: `Недостатньо креслень на складі (є: ${currentQty}, потрібно: ${quantityToFulfill})`,
      };
    }

    // Decrease seller inventory
    const newQty = currentQty - quantityToFulfill;
    const inventoryUpdated = updateSellerInventoryItem(sellerId, blueprintId, newQty);

    if (!inventoryUpdated) {
      return { success: false, error: "Не вдалося оновити інвентар" };
    }

    // Mark as fulfilled (after successful inventory update)
    claim.claimStatus = "fulfilled";
    claim.fulfilledAt = new Date().toISOString();

    // Check if all items are fulfilled
    const allFulfilled = order.itemClaims.every((c) => c.claimStatus === "fulfilled");
    if (allFulfilled) {
      order.status = "completed";
    }

    updateOrder(order);

    return { success: true, claimedItems: [blueprintId] };
  });
}

/**
 * Fulfill all claimed items at once
 * Decreases seller inventory for each fulfilled item
 * Idempotent: Already fulfilled items are skipped (no double decrement)
 */
export async function fulfillAllClaimedItems(
  orderId: string,
  sellerId: string
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    // First pass: verify all items can be fulfilled (inventory check)
    const itemsToFulfill = order.itemClaims.filter(
      (claim) => claim.claimedBySellerId === sellerId && claim.claimStatus === "claimed"
    );

    if (itemsToFulfill.length === 0) {
      return { success: false, error: "Немає позицій для виконання" };
    }

    // Check inventory for all items first
    for (const claim of itemsToFulfill) {
      const currentQty = getSellerBlueprintQuantity(sellerId, claim.blueprintId);
      const quantityNeeded = claim.claimedQuantity || claim.requestedQty;

      if (currentQty < quantityNeeded) {
        return {
          success: false,
          error: `Недостатньо "${claim.blueprintName}" на складі (є: ${currentQty}, потрібно: ${quantityNeeded})`,
        };
      }
    }

    // Second pass: decrease inventory and mark as fulfilled
    const fulfilledItems: string[] = [];
    const now = new Date().toISOString();

    for (const claim of itemsToFulfill) {
      const currentQty = getSellerBlueprintQuantity(sellerId, claim.blueprintId);
      const quantityToFulfill = claim.claimedQuantity || claim.requestedQty;
      const newQty = currentQty - quantityToFulfill;

      // Decrease inventory
      const inventoryUpdated = updateSellerInventoryItem(sellerId, claim.blueprintId, newQty);

      if (!inventoryUpdated) {
        // Rollback is complex - for now, stop and report error
        // Partial fulfillment already done won't be rolled back
        return { success: false, error: `Не вдалося оновити інвентар для "${claim.blueprintName}"` };
      }

      // Mark as fulfilled
      claim.claimStatus = "fulfilled";
      claim.fulfilledAt = now;
      fulfilledItems.push(claim.blueprintId);
    }

    // Check if all items are fulfilled
    const allFulfilled = order.itemClaims.every((c) => c.claimStatus === "fulfilled");
    if (allFulfilled) {
      order.status = "completed";
    }

    updateOrder(order);

    return { success: true, claimedItems: fulfilledItems };
  });
}

/**
 * Close an order for a seller (seller-scoped) or globally (admin)
 *
 * For sellers: Sets per-seller state to "closed", order disappears from their active view
 * For admins: Closes the order globally
 *
 * Global close only happens when:
 * - Admin explicitly closes, OR
 * - All items across all sellers are fulfilled
 */
export async function closeOrder(
  orderId: string,
  sellerId: string,
  isAdmin: boolean = false
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    // Admin can force global close
    if (isAdmin) {
      order.status = "closed";
      order.closedAt = new Date().toISOString();
      order.closedBySellerId = sellerId;
      updateOrder(order);
      return { success: true };
    }

    // Check if already globally closed
    if (order.status === "closed" || order.status === "cancelled") {
      return { success: false, error: "Замовлення вже закрите" };
    }

    // Check if seller already closed for themselves
    if (isOrderClosedBySeller(order, sellerId)) {
      return { success: false, error: "Ви вже закрили це замовлення" };
    }

    // Sellers can close their part if:
    // 1. They are assigned to the order, OR
    // 2. They have claimed items
    const isAssigned = order.assignedSellerId === sellerId;
    const hasClaimedItems = order.itemClaims.some(
      (c) => c.claimedBySellerId === sellerId
    );

    if (!isAssigned && !hasClaimedItems) {
      return { success: false, error: "Ви не можете закрити це замовлення" };
    }

    // Check if seller's items are all fulfilled
    const myUnfulfilledItems = order.itemClaims.filter(
      (c) => c.claimedBySellerId === sellerId && c.claimStatus !== "fulfilled"
    );

    if (myUnfulfilledItems.length > 0) {
      return {
        success: false,
        error: "Спочатку виконайте всі ваші прийняті позиції"
      };
    }

    // Set per-seller closure state
    if (!order.sellerStates) {
      order.sellerStates = [];
    }

    // Find or create seller state
    let sellerState = order.sellerStates.find(s => s.sellerId === sellerId);
    if (!sellerState) {
      sellerState = { sellerId, status: "active" };
      order.sellerStates.push(sellerState);
    }

    sellerState.status = "closed";
    sellerState.closedAt = new Date().toISOString();

    // Check if order should be globally closed
    // Global close when ALL items are fulfilled across ALL sellers
    const allItemsFulfilled = order.itemClaims.every(c => c.claimStatus === "fulfilled");

    if (allItemsFulfilled) {
      order.status = "closed";
      order.closedAt = new Date().toISOString();
      order.closedBySellerId = sellerId;
    }

    updateOrder(order);

    return { success: true };
  });
}

/**
 * Cancel order (admin only)
 */
export async function cancelOrder(
  orderId: string
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    if (order.status === "closed" || order.status === "cancelled") {
      return { success: false, error: "Замовлення вже закрите" };
    }

    order.status = "cancelled";
    order.closedAt = new Date().toISOString();

    updateOrder(order);

    return { success: true };
  });
}

/**
 * Release claim on an item (seller changed mind)
 */
export async function releaseOrderItem(
  orderId: string,
  sellerId: string,
  blueprintId: string
): Promise<ClaimResult> {
  const filePath = getOrderFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order) {
      return { success: false, error: "Замовлення не знайдено" };
    }

    // Can't release from closed orders
    if (order.status === "closed" || order.status === "cancelled") {
      return { success: false, error: "Замовлення вже закрите" };
    }

    const claim = order.itemClaims.find((c) => c.blueprintId === blueprintId);
    if (!claim) {
      return { success: false, error: "Позицію не знайдено" };
    }

    // Can only release own claimed items
    if (claim.claimedBySellerId !== sellerId) {
      return { success: false, error: "Ви не можете скасувати цю позицію" };
    }

    if (claim.claimStatus === "fulfilled") {
      return { success: false, error: "Не можна скасувати виконану позицію" };
    }

    // Release the claim
    claim.claimStatus = "unclaimed";
    claim.claimedBySellerId = undefined;
    claim.claimedBySellerDiscordId = undefined;
    claim.claimedQuantity = undefined;
    claim.claimedAt = undefined;

    // If this seller was assigned and released all items, unassign
    if (order.assignedSellerId === sellerId) {
      const stillHasClaims = order.itemClaims.some(
        (c) => c.claimedBySellerId === sellerId && c.claimStatus !== "unclaimed"
      );

      if (!stillHasClaims) {
        order.assignedSellerId = undefined;
        order.assignedSellerDiscordId = undefined;
        order.assignedAt = undefined;
      }
    }

    // Check if order should go back to "open"
    const hasAnyClaims = order.itemClaims.some((c) => c.claimStatus !== "unclaimed");
    if (!hasAnyClaims) {
      order.status = "open";
    }

    updateOrder(order);

    return { success: true, claimedItems: [blueprintId] };
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Count orders for a specific seller
 */
export function countOrdersForSeller(sellerId: string): number {
  const orders = getOrdersForSeller(sellerId);
  return orders.length;
}

/**
 * Delete order (admin only, for cleanup)
 */
export function deleteOrder(orderId: string): boolean {
  const filePath = getOrderFilePath(orderId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Get order statistics for seller
 */
export function getSellerOrderStats(sellerId: string): {
  activeOrders: number;
  claimedItems: number;
  fulfilledItems: number;
  archivedOrders: number;
} {
  const activeOrders = getOrdersForSeller(sellerId);
  const archivedOrders = getArchivedOrdersForSeller(sellerId);

  let claimedItems = 0;
  let fulfilledItems = 0;

  for (const order of activeOrders) {
    for (const item of order.items) {
      if (item.claimedByMe && item.claimStatus === "claimed") {
        claimedItems++;
      }
    }
  }

  for (const order of archivedOrders) {
    for (const item of order.items) {
      if (item.claimedByMe && item.claimStatus === "fulfilled") {
        fulfilledItems++;
      }
    }
  }

  return {
    activeOrders: activeOrders.length,
    claimedItems,
    fulfilledItems,
    archivedOrders: archivedOrders.length,
  };
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Admin view of an order with complete details
 * Shows all information regardless of seller ownership
 */
export interface AdminOrderView {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  notes?: string;
  isMultiSeller: boolean;
  createdAt: string;
  status: OrderStatus;
  // Assignment info
  assignedSellerId?: string;
  assignedSellerDiscordId?: string;
  assignedAt?: string;
  // Close info
  closedAt?: string;
  closedBySellerId?: string;
  // All items with full claim info
  items: {
    blueprintId: string;
    blueprintName: string;
    requestedQty: number;
    claimStatus: ItemClaimStatus;
    claimedBySellerId?: string;
    claimedBySellerDiscordId?: string;
    claimedQuantity?: number;
    claimedAt?: string;
    fulfilledAt?: string;
  }[];
  // Per-seller states
  sellerStates?: SellerOrderState[];
}

/**
 * Build admin view of an order (full details)
 */
function buildAdminOrderView(order: StoredOrder): AdminOrderView {
  return {
    orderId: order.orderId,
    buyerDiscordNick: order.buyerDiscordNick,
    offer: order.offer,
    notes: order.notes,
    isMultiSeller: order.isMultiSeller,
    createdAt: order.createdAt,
    status: order.status,
    assignedSellerId: order.assignedSellerId,
    assignedSellerDiscordId: order.assignedSellerDiscordId,
    assignedAt: order.assignedAt,
    closedAt: order.closedAt,
    closedBySellerId: order.closedBySellerId,
    items: order.itemClaims.map((claim) => ({
      blueprintId: claim.blueprintId,
      blueprintName: claim.blueprintName,
      requestedQty: claim.requestedQty,
      claimStatus: claim.claimStatus,
      claimedBySellerId: claim.claimedBySellerId,
      claimedBySellerDiscordId: claim.claimedBySellerDiscordId,
      claimedQuantity: claim.claimedQuantity,
      claimedAt: claim.claimedAt,
      fulfilledAt: claim.fulfilledAt,
    })),
    sellerStates: order.sellerStates,
  };
}

/**
 * Get all orders for admin (complete view, no filtering)
 * Returns newest first
 */
export function getAllOrdersForAdmin(): AdminOrderView[] {
  const orders = getAllOrders();
  return orders.map(buildAdminOrderView);
}

/**
 * Get active orders for admin (not closed/cancelled)
 */
export function getActiveOrdersForAdmin(): AdminOrderView[] {
  const orders = getAllOrders();
  return orders
    .filter((o) => o.status !== "closed" && o.status !== "cancelled")
    .map(buildAdminOrderView);
}

/**
 * Get archived orders for admin (closed/cancelled)
 */
export function getArchivedOrdersForAdmin(): AdminOrderView[] {
  const orders = getAllOrders();
  return orders
    .filter((o) => o.status === "closed" || o.status === "cancelled")
    .map(buildAdminOrderView);
}

/**
 * Clear all orders (admin action)
 * Deletes all order files from the orders directory
 * Returns count of deleted orders
 */
export function clearAllOrders(): { success: boolean; deletedCount: number; error?: string } {
  ensureDirectories();

  try {
    if (!fs.existsSync(ORDERS_DIR)) {
      return { success: true, deletedCount: 0 };
    }

    const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith(".json"));
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(ORDERS_DIR, file);
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch {
        // Continue deleting other files even if one fails
        console.error(`Failed to delete order file: ${filePath}`);
      }
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error("Error clearing all orders:", error);
    return { success: false, deletedCount: 0, error: "Не вдалося видалити замовлення" };
  }
}
