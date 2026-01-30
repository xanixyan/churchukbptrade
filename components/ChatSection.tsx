"use client";

import { useState, useEffect, useCallback } from "react";
import OrderChat from "./OrderChat";

interface ChatListItem {
  orderId: string;
  otherPartyName: string;
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
  unreadCount: number;
  orderStatus: string;
}

interface ChatSectionProps {
  onChatCountChange?: (count: number) => void;
}

export default function ChatSection({ onChatCountChange }: ChatSectionProps) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error("Failed to fetch chats");
      }
      const data = await res.json();
      const chatList: ChatListItem[] = data.chats || [];
      setChats(chatList);
      onChatCountChange?.(data.totalUnread || 0);
    } catch (err) {
      console.error("Error fetching chats:", err);
      setError("Не вдалося завантажити чати");
    } finally {
      setLoading(false);
    }
  }, [onChatCountChange]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "open": return "Нове";
      case "in_progress": return "В обробці";
      default: return status;
    }
  };

  if (selectedOrderId) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <OrderChat
          orderId={selectedOrderId}
          onBack={() => {
            setSelectedOrderId(null);
            fetchChats();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-dark-800 rounded-lg border border-dark-600 p-4 animate-pulse">
              <div className="h-4 bg-dark-700 rounded w-1/3 mb-2" />
              <div className="h-3 bg-dark-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      ) : chats.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-8 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            Чатів поки немає
          </h3>
          <p className="text-sm text-gray-500">
            Чати з&apos;являться для активних замовлень з призначеним продавцем
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.orderId}
              onClick={() => setSelectedOrderId(chat.orderId)}
              className="w-full text-left p-4 bg-dark-800 rounded-lg border border-dark-600 hover:border-dark-500 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {chat.otherPartyName}
                    </span>
                    <span className="text-xs text-gray-600 px-1.5 py-0.5 bg-dark-700 rounded">
                      {statusLabel(chat.orderStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mb-1">{chat.orderId}</p>
                  {chat.lastMessage ? (
                    <p className="text-sm text-gray-400 truncate">
                      {chat.lastMessage}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 italic">
                      Немає повідомлень
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {chat.lastMessageAt && (
                    <span className="text-xs text-gray-600">
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  )}
                  {chat.unreadCount > 0 ? (
                    <span className="min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-xs font-bold bg-neon-cyan text-dark-900 rounded-full">
                      {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                    </span>
                  ) : (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {chats.length > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => { setLoading(true); fetchChats(); }}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Оновити список
          </button>
        </div>
      )}
    </div>
  );
}
