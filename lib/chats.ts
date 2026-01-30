/**
 * Order chat storage and management.
 * Chats are scoped to orders and deleted when orders finish.
 *
 * ROOT CAUSE FIX (v2): Chat list derived from ORDERS, not chat files.
 * ROOT CAUSE FIX (v3): Badge shows unread count, not active-chat count.
 *   Previously Header used `data.chats.length` as badge — counting all active chats.
 *   Now each ChatRecord stores readState (buyerLastReadAt / sellerLastReadAt) and the
 *   list endpoint returns per-chat unreadCount + totalUnread across all chats.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { safeWriteJson, safeReadJson, withFileLock } from "./safe-file";
import { getOrderById, getAllOrders, StoredOrder } from "./orders";

const CHATS_DIR = path.join(process.cwd(), "data", "chats");

export const MAX_MESSAGE_LENGTH = 1000;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_MESSAGES = 30;

// ============================================
// TYPES
// ============================================

export type ChatSenderType = "buyer" | "seller";

export interface ChatMessage {
  id: string;
  orderId: string;
  senderType: ChatSenderType;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface ChatReadState {
  buyerLastReadAt: string | null;
  sellerLastReadAt: string | null;
}

export interface ChatRecord {
  orderId: string;
  buyerId: string;
  buyerDiscordId: string;
  sellerId: string;
  sellerDiscordId: string;
  messages: ChatMessage[];
  readState: ChatReadState;
  createdAt: string;
}

// In-memory SSE subscriber registry
type SSECallback = (message: ChatMessage) => void;
const subscribers = new Map<string, Set<SSECallback>>();

// In-memory rate limit (userId -> timestamps[])
const chatRateLimits = new Map<string, number[]>();

// ============================================
// HELPERS
// ============================================

function ensureDirectories(): void {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
}

function getChatFilePath(orderId: string): string {
  const safeId = orderId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(CHATS_DIR, `${safeId}.json`);
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isOrderFinished(order: StoredOrder): boolean {
  return order.status === "completed" || order.status === "closed" || order.status === "cancelled";
}

/** Chat is only available after a seller has accepted/claimed (status moves past "open"). */
export function isOrderAcceptedForChat(order: StoredOrder): boolean {
  return order.status === "in_progress";
}

function getFulfillingSeller(order: StoredOrder): { sellerId: string; sellerDiscordId: string } | null {
  if (order.assignedSellerId && order.assignedSellerDiscordId) {
    return { sellerId: order.assignedSellerId, sellerDiscordId: order.assignedSellerDiscordId };
  }
  if (order.sellerIds && order.sellerIds.length > 0) {
    const sellerId = order.sellerIds[0];
    const group = order.sellerGroups?.find(g => g.sellerId === sellerId);
    if (group) {
      return { sellerId, sellerDiscordId: group.sellerDiscordId };
    }
    return { sellerId, sellerDiscordId: sellerId };
  }
  return null;
}

/**
 * Count unread messages for a given role in a chat.
 * Unread = messages from the OTHER party created after lastReadAt.
 */
function countUnread(chat: ChatRecord, role: "buyer" | "seller"): number {
  const lastReadAt = role === "buyer"
    ? chat.readState?.buyerLastReadAt
    : chat.readState?.sellerLastReadAt;

  const otherSenderType: ChatSenderType = role === "buyer" ? "seller" : "buyer";

  let count = 0;
  for (const msg of chat.messages) {
    if (msg.senderType !== otherSenderType) continue;
    if (!lastReadAt || msg.createdAt > lastReadAt) {
      count++;
    }
  }
  return count;
}

// ============================================
// RATE LIMITING
// ============================================

export function checkChatRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = chatRateLimits.get(userId) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
    chatRateLimits.set(userId, recent);
    return false;
  }
  recent.push(now);
  chatRateLimits.set(userId, recent);
  return true;
}

// ============================================
// AUTHORIZATION
// ============================================

export interface ChatAuthResult {
  authorized: boolean;
  senderType?: ChatSenderType;
  senderId?: string;
  senderName?: string;
  order?: StoredOrder;
  error?: string;
}

export function authorizeChatAccess(
  orderId: string,
  userRole: "buyer" | "seller",
  userId: string,
  discordId: string
): ChatAuthResult {
  const order = getOrderById(orderId);
  if (!order) {
    return { authorized: false, error: "Замовлення не знайдено" };
  }
  if (isOrderFinished(order)) {
    return { authorized: false, error: "Замовлення завершено, чат недоступний" };
  }
  if (!isOrderAcceptedForChat(order)) {
    return { authorized: false, error: "Чат доступний після прийняття замовлення продавцем" };
  }

  if (userRole === "buyer") {
    const isBuyerOwner =
      order.buyerDiscordId === discordId ||
      (order.buyerDiscordNick && order.buyerDiscordNick === discordId);
    if (!isBuyerOwner) {
      return { authorized: false, error: "Доступ заборонено" };
    }
    return { authorized: true, senderType: "buyer", senderId: userId, senderName: discordId, order };
  }

  if (userRole === "seller") {
    const isTargetedSeller = order.sellerIds && order.sellerIds.includes(userId);
    if (!isTargetedSeller) {
      return { authorized: false, error: "Доступ заборонено" };
    }
    return { authorized: true, senderType: "seller", senderId: userId, senderName: discordId, order };
  }

  return { authorized: false, error: "Доступ заборонено" };
}

// ============================================
// CHAT CRUD
// ============================================

export function getOrCreateChat(order: StoredOrder): ChatRecord | null {
  ensureDirectories();
  const filePath = getChatFilePath(order.orderId);

  const existing = safeReadJson<ChatRecord>(filePath);
  if (existing) {
    // Migrate old records missing readState
    if (!existing.readState) {
      existing.readState = { buyerLastReadAt: null, sellerLastReadAt: null };
      safeWriteJson(filePath, existing);
    }
    return existing;
  }

  // Only create chat after seller has accepted the order
  if (!isOrderAcceptedForChat(order)) return null;

  const fulfilling = getFulfillingSeller(order);
  if (!fulfilling) return null;

  const chat: ChatRecord = {
    orderId: order.orderId,
    buyerId: order.buyerId || "",
    buyerDiscordId: order.buyerDiscordId || order.buyerDiscordNick,
    sellerId: fulfilling.sellerId,
    sellerDiscordId: fulfilling.sellerDiscordId,
    messages: [],
    readState: { buyerLastReadAt: null, sellerLastReadAt: null },
    createdAt: new Date().toISOString(),
  };

  safeWriteJson(filePath, chat);
  return chat;
}

export function getChat(orderId: string): ChatRecord | null {
  ensureDirectories();
  const filePath = getChatFilePath(orderId);
  return safeReadJson<ChatRecord>(filePath);
}

/**
 * Mark a chat as read for a given role. Sets lastReadAt = now.
 */
export async function markChatRead(
  orderId: string,
  role: "buyer" | "seller"
): Promise<boolean> {
  const filePath = getChatFilePath(orderId);

  return withFileLock(filePath, () => {
    const chat = getChat(orderId);
    if (!chat) return false;

    if (!chat.readState) {
      chat.readState = { buyerLastReadAt: null, sellerLastReadAt: null };
    }

    const now = new Date().toISOString();
    if (role === "buyer") {
      chat.readState.buyerLastReadAt = now;
    } else {
      chat.readState.sellerLastReadAt = now;
    }

    safeWriteJson(filePath, chat);
    return true;
  });
}

export async function addChatMessage(
  orderId: string,
  senderType: ChatSenderType,
  senderId: string,
  senderName: string,
  text: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { success: false, error: "Повідомлення не може бути порожнім" };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { success: false, error: `Максимальна довжина повідомлення: ${MAX_MESSAGE_LENGTH} символів` };
  }
  if (!checkChatRateLimit(senderId)) {
    return { success: false, error: "Забагато повідомлень. Зачекайте хвилину." };
  }

  const filePath = getChatFilePath(orderId);

  return withFileLock(filePath, () => {
    const order = getOrderById(orderId);
    if (!order || isOrderFinished(order)) {
      return { success: false, error: "Замовлення завершено, чат недоступний" };
    }
    if (!isOrderAcceptedForChat(order)) {
      return { success: false, error: "Чат доступний після прийняття замовлення продавцем" };
    }

    let chat = getChat(orderId);
    if (!chat) {
      chat = getOrCreateChat(order);
      if (!chat) {
        return { success: false, error: "Не вдалося створити чат" };
      }
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      orderId,
      senderType,
      senderId,
      senderName,
      text: escapeHtml(trimmed),
      createdAt: new Date().toISOString(),
    };

    chat.messages.push(message);

    // Auto-mark read for the sender (they just wrote, so they've seen everything)
    if (!chat.readState) {
      chat.readState = { buyerLastReadAt: null, sellerLastReadAt: null };
    }
    if (senderType === "buyer") {
      chat.readState.buyerLastReadAt = message.createdAt;
    } else {
      chat.readState.sellerLastReadAt = message.createdAt;
    }

    safeWriteJson(filePath, chat);
    notifySubscribers(orderId, message);

    return { success: true, message };
  });
}

export function deleteChatForOrder(orderId: string): boolean {
  const filePath = getChatFilePath(orderId);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    notifyChatClosed(orderId);
    return true;
  } catch (error) {
    console.error(`Failed to delete chat for order ${orderId}:`, error);
    return false;
  }
}

// ============================================
// SSE SUBSCRIBER MANAGEMENT
// ============================================

export function subscribeToChatUpdates(orderId: string, callback: SSECallback): () => void {
  if (!subscribers.has(orderId)) {
    subscribers.set(orderId, new Set());
  }
  subscribers.get(orderId)!.add(callback);

  return () => {
    const subs = subscribers.get(orderId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(orderId);
      }
    }
  };
}

function notifySubscribers(orderId: string, message: ChatMessage): void {
  const subs = subscribers.get(orderId);
  if (subs) {
    Array.from(subs).forEach(callback => {
      try { callback(message); } catch { /* ignore */ }
    });
  }
}

function notifyChatClosed(orderId: string): void {
  const subs = subscribers.get(orderId);
  if (subs) {
    const closedMsg: ChatMessage = {
      id: "system-closed",
      orderId,
      senderType: "buyer",
      senderId: "system",
      senderName: "Система",
      text: "__CHAT_CLOSED__",
      createdAt: new Date().toISOString(),
    };
    Array.from(subs).forEach(callback => {
      try { callback(closedMsg); } catch { /* ignore */ }
    });
    subscribers.delete(orderId);
  }
}

// ============================================
// LIST CHATS FOR USER (ORDER-DERIVED, WITH UNREAD)
// ============================================

export interface ChatListItem {
  orderId: string;
  otherPartyName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
  unreadCount: number;
  orderStatus: string;
}

export interface ChatListResult {
  chats: ChatListItem[];
  totalUnread: number;
}

/**
 * List all active chats for a user, with per-chat unread counts.
 */
export function listChatsForUser(
  userRole: "buyer" | "seller",
  userId: string,
  discordId: string
): ChatListResult {
  const allOrders = getAllOrders();
  const chats: ChatListItem[] = [];
  let totalUnread = 0;

  for (const order of allOrders) {
    if (isOrderFinished(order)) continue;
    if (!isOrderAcceptedForChat(order)) continue;

    const fulfilling = getFulfillingSeller(order);
    if (!fulfilling) continue;

    let isParticipant = false;
    let otherPartyName = "";

    if (userRole === "buyer") {
      const isBuyerOwner =
        order.buyerDiscordId === discordId ||
        (order.buyerDiscordNick && order.buyerDiscordNick === discordId);
      if (isBuyerOwner) {
        isParticipant = true;
        otherPartyName = fulfilling.sellerDiscordId;
      }
    } else if (userRole === "seller") {
      const isTargetedSeller = order.sellerIds && order.sellerIds.includes(userId);
      if (isTargetedSeller) {
        isParticipant = true;
        otherPartyName = order.buyerDiscordId || order.buyerDiscordNick;
      }
    }

    if (!isParticipant) continue;

    const chat = getOrCreateChat(order);

    const lastMsg = chat && chat.messages.length > 0
      ? chat.messages[chat.messages.length - 1]
      : undefined;

    const unreadCount = chat ? countUnread(chat, userRole) : 0;
    totalUnread += unreadCount;

    chats.push({
      orderId: order.orderId,
      otherPartyName,
      lastMessage: lastMsg?.text,
      lastMessageAt: lastMsg?.createdAt,
      messageCount: chat ? chat.messages.length : 0,
      unreadCount,
      orderStatus: order.status,
    });
  }

  chats.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return 0;
  });

  return { chats, totalUnread };
}
