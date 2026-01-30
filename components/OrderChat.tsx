"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  orderId: string;
  senderType: "buyer" | "seller";
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface OrderChatProps {
  orderId: string;
  onBack: () => void;
}

export default function OrderChat({ orderId, onBack }: OrderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [chatClosed, setChatClosed] = useState(false);
  const [chatInfo, setChatInfo] = useState<{ buyerDiscordId: string; sellerDiscordId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);

  // Check if scrolled near bottom
  const checkNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((force?: boolean) => {
    if (force || isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Mark chat as read
  const markRead = useCallback(() => {
    fetch(`/api/chats/${orderId}/read`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [orderId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${orderId}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          const data = await res.json();
          if (data.error?.includes("завершено")) {
            setChatClosed(true);
            return;
          }
          setError(data.error || "Доступ заборонено");
          return;
        }
        throw new Error("Failed to fetch messages");
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setChatInfo({ buyerDiscordId: data.buyerDiscordId, sellerDiscordId: data.sellerDiscordId });
      // Force scroll on initial load
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Не вдалося завантажити повідомлення");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Set up SSE
  useEffect(() => {
    fetchMessages().then(() => markRead());

    const eventSource = new EventSource(`/api/chats/${orderId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("message", (e) => {
      try {
        const message: ChatMessage = JSON.parse(e.data);
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        if (isNearBottomRef.current) {
          markRead();
        }
      } catch {
        // ignore parse errors
      }
    });

    eventSource.addEventListener("chat_closed", () => {
      setChatClosed(true);
      eventSource.close();
    });

    eventSource.onerror = () => {
      // SSE will auto-reconnect, but if chat is closed we stop
      if (chatClosed) {
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [orderId, fetchMessages, chatClosed, markRead]);

  // Auto-scroll when messages change (only if near bottom)
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkNearBottom();
    if (isNearBottomRef.current) {
      markRead();
    }
  }, [checkNearBottom, markRead]);

  // Send message
  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || sending || chatClosed) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch(`/api/chats/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("завершено")) {
          setChatClosed(true);
          return;
        }
        setError(data.error || "Помилка відправки");
        return;
      }

      setNewMessage("");
      // Message will arrive via SSE, but also add it locally for instant feedback
      if (data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      inputRef.current?.focus();
    } catch {
      setError("Помилка відправки повідомлення");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const msgDate = formatDate(msg.createdAt);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  if (chatClosed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-400 mb-2">Замовлення завершено</h3>
        <p className="text-sm text-gray-500 mb-6">Чат закрито</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm bg-dark-700 text-gray-300 border border-dark-600 rounded-lg hover:border-dark-500 transition-colors"
        >
          Назад до списку
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-dark-600">
        <button
          onClick={onBack}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            Чат: {orderId}
          </p>
          {chatInfo && (
            <p className="text-xs text-gray-500">
              {chatInfo.buyerDiscordId} ↔ {chatInfo.sellerDiscordId}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-400">Завантаження...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">Повідомлень поки немає. Почніть розмову!</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className="text-xs text-gray-600 bg-dark-800 px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex mb-2 ${msg.senderType === "buyer" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 ${
                      msg.senderType === "buyer"
                        ? "bg-dark-700 text-white rounded-bl-sm"
                        : "bg-neon-cyan/15 text-white rounded-br-sm"
                    }`}
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${
                        msg.senderType === "buyer" ? "text-blue-400" : "text-neon-cyan"
                      }`}>
                        {msg.senderType === "buyer" ? "Покупець" : "Продавець"}
                      </span>
                      <span className="text-xs text-gray-600">{msg.senderName}</span>
                    </div>
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs text-gray-600 text-right mt-0.5">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm text-red-400 bg-red-500/10 border-t border-red-500/20">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-dark-600">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введіть повідомлення..."
            maxLength={1000}
            disabled={sending}
            className="flex-1 px-4 py-2 bg-dark-700 text-white border border-dark-600 rounded-lg focus:outline-none focus:border-neon-cyan/50 placeholder-gray-500 text-sm disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-right">
          {newMessage.length}/1000
        </p>
      </div>
    </div>
  );
}
