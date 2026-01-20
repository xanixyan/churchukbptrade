"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BLUEPRINT_TYPES, BlueprintType } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useNewOrderNotification } from "@/hooks/useNewOrderNotification";

interface BlueprintWithQuantity {
  id: string;
  name: string;
  slug: string;
  image: string;
  type: BlueprintType;
  quantity: number;
}

interface SellerInfo {
  id: string;
  discordId: string;
  status: string;
}

type ItemClaimStatus = "unclaimed" | "claimed" | "fulfilled";
type OrderStatus = "open" | "in_progress" | "completed" | "closed" | "cancelled";

interface OrderItem {
  blueprintId: string;
  blueprintName: string;
  requestedQty: number;
  available: boolean;
  availableQty: number;
  claimStatus: ItemClaimStatus;
  claimedByMe: boolean;
  claimedBySellerId?: string;
  claimedBySellerDiscordId?: string;
  claimedQuantity?: number;
}

interface SellerOrder {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  notes?: string;
  isMultiSeller: boolean;
  createdAt: string;
  status: OrderStatus;
  isAssignedToMe: boolean;
  isClosedByMe: boolean;
  items: OrderItem[];
  canAcceptFull: boolean;
  claimableItemCount: number;
  myClaimedItemCount: number;
}

interface PendingChange {
  quantity: number;
}

export default function SellerDashboard() {
  // Global auth context
  const { setAuthState: setGlobalAuthState } = useAuth();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [seller, setSeller] = useState<SellerInfo | null>(null);

  // Blueprints state
  const [blueprints, setBlueprints] = useState<BlueprintWithQuantity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Pending changes (blueprintId -> changes)
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BlueprintType | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "instock" | "outofstock">("all");

  // Tab state
  const [activeTab, setActiveTab] = useState<"inventory" | "orders" | "archived">("inventory");

  // Orders state
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<SellerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Copy toast state
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // New order notification hook
  const { initAudio, unlockAudio, processOrders, reset: resetNotifications } = useNewOrderNotification();

  // Ref for audio unlock listener
  const audioUnlockAttached = useRef(false);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyToast(`${label} скопійовано`);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setCopyToast(`${label} скопійовано`);
        } catch {
          setCopyToast("Натисніть Ctrl+C для копіювання");
        }
        document.body.removeChild(textArea);
      }
    } catch {
      setCopyToast("Помилка копіювання");
    }

    // Auto-hide toast after 2 seconds
    setTimeout(() => setCopyToast(null), 2000);
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Initialize audio and attach unlock listener when authenticated
  useEffect(() => {
    if (isAuthenticated && !audioUnlockAttached.current) {
      // Initialize audio element
      initAudio();

      // Unlock audio on first user interaction
      const handleInteraction = () => {
        unlockAudio();
        // Remove listeners after first interaction
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("keydown", handleInteraction);
      };

      document.addEventListener("click", handleInteraction);
      document.addEventListener("keydown", handleInteraction);
      audioUnlockAttached.current = true;

      return () => {
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("keydown", handleInteraction);
      };
    }
  }, [isAuthenticated, initAudio, unlockAudio]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/seller/auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated && data.seller) {
        setSeller(data.seller);
        fetchInventory();
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");
    setStatusMessage("");

    try {
      const res = await fetch("/api/seller/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setSeller(data.seller);
        // Update global auth state immediately for header
        setGlobalAuthState(true, data.seller);
        setDiscordId("");
        setPassword("");
        fetchInventory();
      } else {
        setAuthError(data.error || "Помилка входу");
        if (data.statusMessage) {
          setStatusMessage(data.statusMessage);
        }
      }
    } catch {
      setAuthError("Помилка з'єднання");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/seller/auth", { method: "DELETE" });
    } finally {
      setIsAuthenticated(false);
      setSeller(null);
      // Update global auth state immediately for header
      setGlobalAuthState(false, null);
      setBlueprints([]);
      setPendingChanges(new Map());
      setOrders([]);
      setArchivedOrders([]);
      // Reset notification tracking
      resetNotifications();
    }
  };

  const fetchInventory = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/seller/inventory");
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setBlueprints(data.blueprints || []);
      if (data.seller) {
        setSeller(data.seller);
      }
    } catch {
      setError("Не вдалося завантажити інвентар");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async (archived = false) => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const url = archived ? "/api/seller/orders?archived=true" : "/api/seller/orders";
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Failed to fetch orders");
      }
      const data = await res.json();
      if (archived) {
        setArchivedOrders(data.orders || []);
      } else {
        const fetchedOrders = data.orders || [];
        setOrders(fetchedOrders);

        // Process orders for new order notification (only for active orders)
        processOrders(fetchedOrders);
      }
    } catch {
      setOrdersError("Не вдалося завантажити замовлення");
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch orders when switching to orders/archived tab
  useEffect(() => {
    if (isAuthenticated && activeTab === "orders") {
      fetchOrders(false);
    } else if (isAuthenticated && activeTab === "archived") {
      fetchOrders(true);
    }
  }, [isAuthenticated, activeTab]);

  // Polling configuration
  const POLL_INTERVAL_ACTIVE = 5000;   // 5 seconds when tab is visible
  const POLL_INTERVAL_HIDDEN = 15000;  // 15 seconds when tab is hidden

  // Poll for new orders periodically when authenticated and seller is ACTIVE
  // This enables new order notifications in near real-time
  useEffect(() => {
    // Only poll for authenticated ACTIVE sellers
    if (!isAuthenticated || !seller || seller.status !== "active") return;

    let pollIntervalId: NodeJS.Timeout | null = null;
    let currentInterval = POLL_INTERVAL_ACTIVE;

    // Silent background fetch for polling (doesn't trigger loading state)
    const pollOrders = () => {
      fetch("/api/seller/orders", { credentials: "include" })
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status === 401) {
            setIsAuthenticated(false);
          }
          throw new Error("Failed");
        })
        .then((data) => {
          const fetchedOrders = data.orders || [];

          // Always update orders state so UI stays fresh
          setOrders(fetchedOrders);

          // Process for new order notifications
          processOrders(fetchedOrders);
        })
        .catch(() => {
          // Silently fail background polls
        });
    };

    // Start polling with given interval
    const startPolling = (interval: number) => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
      currentInterval = interval;
      pollIntervalId = setInterval(pollOrders, interval);
    };

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - use slower polling
        startPolling(POLL_INTERVAL_HIDDEN);
      } else {
        // Tab is visible - use fast polling and fetch immediately
        startPolling(POLL_INTERVAL_ACTIVE);
        pollOrders(); // Immediate fetch when tab becomes visible
      }
    };

    // Initial fetch
    pollOrders();

    // Start polling based on current visibility
    if (document.hidden) {
      startPolling(POLL_INTERVAL_HIDDEN);
    } else {
      startPolling(POLL_INTERVAL_ACTIVE);
    }

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, seller, processOrders]);

  // Order action handler
  const handleOrderAction = async (
    orderId: string,
    action: string,
    blueprintId?: string,
    blueprintIds?: string[]
  ) => {
    setActionLoading(action + (blueprintId || ""));
    setActionMessage(null);

    try {
      const res = await fetch(`/api/seller/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, blueprintId, blueprintIds }),
      });

      const data = await res.json();

      if (data.success) {
        setActionMessage({ type: "success", text: data.message });

        // Update selected order if we have the updated one
        if (data.order) {
          setSelectedOrder(data.order);
        }

        // Refresh orders list
        await fetchOrders(false);

        // If the order was closed, it moves to archived
        if (action === "close") {
          setSelectedOrder(null);
          await fetchOrders(true);
        }
      } else {
        setActionMessage({ type: "error", text: data.error });
      }
    } catch {
      setActionMessage({ type: "error", text: "Помилка з'єднання" });
    } finally {
      setActionLoading(null);
    }
  };

  // Get current quantity for a blueprint (pending or original)
  const getCurrentQuantity = useCallback(
    (bp: BlueprintWithQuantity): number => {
      const pending = pendingChanges.get(bp.id);
      if (pending !== undefined) {
        return pending.quantity;
      }
      return bp.quantity;
    },
    [pendingChanges]
  );

  // Update quantity
  const updateQuantity = useCallback(
    (blueprintId: string, quantity: number) => {
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        const bp = blueprints.find((b) => b.id === blueprintId);
        if (!bp) return prev;

        const newQty = Math.max(0, Math.floor(quantity));

        if (newQty === bp.quantity) {
          newMap.delete(blueprintId);
        } else {
          newMap.set(blueprintId, { quantity: newQty });
        }

        return newMap;
      });
      setSaveMessage("");
    },
    [blueprints]
  );

  const resetChanges = useCallback(() => {
    setPendingChanges(new Map());
    setSaveMessage("");
  }, []);

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    setSaveMessage("");

    const updates = Array.from(pendingChanges.entries()).map(([blueprintId, changes]) => ({
      blueprintId,
      quantity: changes.quantity,
    }));

    try {
      const res = await fetch("/api/seller/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        if (res.status === 403) {
          setSaveMessage("У вас немає дозволу на зміну інвентарю");
          return;
        }
        throw new Error("Save failed");
      }

      const data = await res.json();
      setSaveMessage(data.message || "Зміни збережено");

      await fetchInventory();
      setPendingChanges(new Map());
    } catch {
      setSaveMessage("Не вдалося зберегти зміни");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered blueprints
  const filteredBlueprints = useMemo(() => {
    let result = blueprints;

    if (categoryFilter) {
      result = result.filter((bp) => bp.type === categoryFilter);
    }

    if (availabilityFilter !== "all") {
      result = result.filter((bp) => {
        const qty = getCurrentQuantity(bp);
        return availabilityFilter === "instock" ? qty > 0 : qty === 0;
      });
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        (bp) =>
          bp.name.toLowerCase().includes(query) ||
          bp.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [blueprints, categoryFilter, availabilityFilter, search, getCurrentQuantity]);

  // Count stats
  const stats = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    let totalQty = 0;

    for (const bp of blueprints) {
      const qty = getCurrentQuantity(bp);
      if (qty > 0) {
        inStock++;
        totalQty += qty;
      } else {
        outOfStock++;
      }
    }

    return { inStock, outOfStock, totalQty };
  }, [blueprints, getCurrentQuantity]);

  // Helper functions
  const getStatusBadge = (status: OrderStatus) => {
    const badges: Record<OrderStatus, { bg: string; text: string; label: string }> = {
      open: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Відкрито" },
      in_progress: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "В роботі" },
      completed: { bg: "bg-green-500/20", text: "text-green-400", label: "Виконано" },
      closed: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Закрито" },
      cancelled: { bg: "bg-red-500/20", text: "text-red-400", label: "Скасовано" },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getItemStatusBadge = (item: OrderItem) => {
    if (item.claimStatus === "fulfilled") {
      return (
        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
          Виконано
        </span>
      );
    }
    if (item.claimedByMe) {
      return (
        <span className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan text-xs rounded">
          Прийнято вами
        </span>
      );
    }
    if (item.claimStatus === "claimed") {
      return (
        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
          Прийнято іншим
        </span>
      );
    }
    if (item.available) {
      return (
        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
          Можна прийняти
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
        Недостатньо
      </span>
    );
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400">Завантаження...</div>
      </div>
    );
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-dark-800 rounded-lg p-6 border border-dark-600">
            <h1 className="text-xl font-bold text-white mb-2 text-center">Кабінет продавця</h1>
            <p className="text-sm text-gray-400 mb-6 text-center">
              Увійдіть, щоб отримати доступ до вашого інвентарю
            </p>

            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label htmlFor="discordId" className="block text-sm text-gray-400 mb-2">
                  Discord ID
                </label>
                <input
                  id="discordId"
                  type="text"
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                  placeholder="Ваш Discord username або ID"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                  placeholder="Ваш пароль"
                />
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {authError}
                  {statusMessage && (
                    <p className="mt-1 text-gray-400">{statusMessage}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || !discordId.trim() || !password}
                className="w-full py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? "Вхід..." : "Увійти"}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-dark-600 text-center">
              <p className="text-sm text-gray-400 mb-2">
                Немає облікового запису?
              </p>
              <a
                href="/seller/register"
                className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
              >
                Зареєструватися як продавець
              </a>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Повернутися до каталогу
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render order detail view
  const renderOrderDetail = (order: SellerOrder, isArchived: boolean) => {
    const myClaimedItems = order.items.filter((item) => item.claimedByMe);
    const unclaimedItems = order.items.filter((item) => item.claimStatus === "unclaimed");
    const canFulfillAll = myClaimedItems.length > 0 && myClaimedItems.every((item) => item.claimStatus === "claimed");
    const canClose = myClaimedItems.length > 0 && myClaimedItems.every((item) => item.claimStatus === "fulfilled");

    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedOrder(null)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>&larr;</span>
            <span>Назад до списку</span>
          </button>
          <div className="flex items-center gap-3">
            {getStatusBadge(order.status)}
            <span className="text-xs text-gray-500">
              {new Date(order.createdAt).toLocaleString("uk-UA")}
            </span>
          </div>
        </div>

        {/* Order info */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-2">
            Замовлення #{order.orderId}
          </h2>
          <div className="flex flex-wrap gap-2">
            {order.isMultiSeller && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                Мульти-продавець
              </span>
            )}
            {order.isAssignedToMe && (
              <span className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan text-xs rounded">
                Призначено вам
              </span>
            )}
          </div>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            actionMessage.type === "error"
              ? "bg-red-500/10 border border-red-500/30 text-red-400"
              : "bg-green-500/10 border border-green-500/30 text-green-400"
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Buyer info - compact single row */}
        <div className="bg-dark-700 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-400">Покупець:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-mono text-sm">{order.buyerDiscordNick}</span>
            <button
              onClick={() => copyToClipboard(order.buyerDiscordNick, "Discord")}
              className="p-1 bg-dark-600 hover:bg-dark-500 rounded text-gray-400 hover:text-neon-cyan transition-colors"
              title="Скопіювати Discord"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Offer - safe rendering for long text */}
        <div className="bg-dark-700 rounded-lg p-4 mb-4 overflow-hidden">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Пропозиція</h3>
          <p className="text-white whitespace-pre-wrap break-words overflow-wrap-anywhere max-h-48 overflow-y-auto">
            {order.offer}
          </p>
        </div>

        {order.notes && (
          <div className="bg-dark-700 rounded-lg p-4 mb-4 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Примітки</h3>
            <p className="text-white whitespace-pre-wrap break-words overflow-wrap-anywhere max-h-48 overflow-y-auto">
              {order.notes}
            </p>
          </div>
        )}

        {/* Message template for seller to send to buyer */}
        {myClaimedItems.length > 0 && !isArchived && (
          <div className="bg-dark-700 rounded-lg p-4 mb-6 border border-neon-purple/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neon-purple">Повідомлення клієнту (скопіювати)</h3>
              <button
                onClick={() => {
                  const blueprintNames = myClaimedItems.map(item => `- ${item.blueprintName}`).join("\n");
                  const message = `Вітаю! Я продавець щодо вашого замовлення.

Блюпринти, які я можу видати:
${blueprintNames}

Напишіть, будь ласка, коли вам зручно — домовимось про передачу.`;
                  copyToClipboard(message, "Повідомлення");
                }}
                className="px-3 py-1.5 bg-neon-purple/20 text-neon-purple border border-neon-purple/40 rounded-lg text-xs font-medium hover:bg-neon-purple/30 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Копіювати
              </button>
            </div>
            <div className="bg-dark-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap font-mono">
              <p>Вітаю! Я продавець щодо вашого замовлення.</p>
              <p className="mt-2">Блюпринти, які я можу видати:</p>
              {myClaimedItems.map(item => (
                <p key={item.blueprintId} className="text-white">- {item.blueprintName}</p>
              ))}
              <p className="mt-2">Напишіть, будь ласка, коли вам зручно — домовимось про передачу.</p>
            </div>
          </div>
        )}

        {/* Action buttons (only for active orders) */}
        {!isArchived && order.status !== "closed" && order.status !== "cancelled" && (
          <div className="bg-dark-700 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Дії</h3>
            <div className="flex flex-wrap gap-3">
              {/* Accept full order */}
              {order.canAcceptFull && (
                <button
                  onClick={() => handleOrderAction(order.orderId, "accept")}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "accept" ? "..." : "Прийняти замовлення"}
                </button>
              )}

              {/* Claim available items */}
              {!order.canAcceptFull && order.claimableItemCount > 0 && (
                <button
                  onClick={() => handleOrderAction(order.orderId, "claim")}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg text-sm font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "claim" ? "..." : `Прийняти доступні (${order.claimableItemCount})`}
                </button>
              )}

              {/* Fulfill all claimed items */}
              {canFulfillAll && (
                <button
                  onClick={() => handleOrderAction(order.orderId, "fulfill_all")}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "fulfill_all" ? "..." : "Виконати всі мої позиції"}
                </button>
              )}

              {/* Close order */}
              {canClose && (
                <button
                  onClick={() => handleOrderAction(order.orderId, "close")}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 bg-gray-500/20 text-gray-400 border border-gray-500/40 rounded-lg text-sm font-medium hover:bg-gray-500/30 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "close" ? "..." : "Закрити замовлення"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Items table */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Позиції замовлення ({order.items.length})
          </h3>
          <div className="bg-dark-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-600 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">Креслення</th>
                  <th className="px-4 py-3 font-medium text-center">Запитано</th>
                  <th className="px-4 py-3 font-medium text-center">У вас є</th>
                  <th className="px-4 py-3 font-medium text-center">Статус</th>
                  {!isArchived && order.status !== "closed" && (
                    <th className="px-4 py-3 font-medium text-center">Дії</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600">
                {order.items.map((item) => (
                  <tr key={item.blueprintId} className="hover:bg-dark-600/50">
                    <td className="px-4 py-3">
                      <div className="text-white">{item.blueprintName}</div>
                      <div className="text-xs text-gray-500">{item.blueprintId}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-white">
                      {item.requestedQty}
                    </td>
                    <td className="px-4 py-3 text-center text-white">
                      {item.availableQty}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getItemStatusBadge(item)}
                    </td>
                    {!isArchived && order.status !== "closed" && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Fulfill single item */}
                          {item.claimedByMe && item.claimStatus === "claimed" && (
                            <button
                              onClick={() => handleOrderAction(order.orderId, "fulfill", item.blueprintId)}
                              disabled={actionLoading !== null}
                              className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `fulfill${item.blueprintId}` ? "..." : "Виконати"}
                            </button>
                          )}

                          {/* Release claim */}
                          {item.claimedByMe && item.claimStatus === "claimed" && (
                            <button
                              onClick={() => handleOrderAction(order.orderId, "release", item.blueprintId)}
                              disabled={actionLoading !== null}
                              className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-xs hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === `release${item.blueprintId}` ? "..." : "Скасувати"}
                            </button>
                          )}

                          {/* Claim single item */}
                          {item.claimStatus === "unclaimed" && item.available && (
                            <button
                              onClick={() => handleOrderAction(order.orderId, "claim", undefined, [item.blueprintId])}
                              disabled={actionLoading !== null}
                              className="px-2 py-1 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded text-xs hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
                            >
                              Прийняти
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render orders list
  const renderOrdersList = (ordersList: SellerOrder[], isArchived: boolean) => {
    if (ordersLoading) {
      return <div className="text-center py-12 text-gray-400">Завантаження замовлень...</div>;
    }

    if (ordersList.length === 0) {
      return (
        <div className="bg-dark-800 rounded-lg border border-dark-600 p-12 text-center">
          <p className="text-gray-500">
            {isArchived ? "Архівних замовлень немає" : "Активних замовлень немає"}
          </p>
          {!isArchived && (
            <p className="text-sm text-gray-600 mt-2">
              Коли покупці замовлять ваші креслення, вони з&apos;являться тут
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-700 text-left text-sm text-gray-400">
                <th className="px-4 py-3 font-medium">Замовлення</th>
                <th className="px-4 py-3 font-medium">Покупець</th>
                <th className="px-4 py-3 font-medium text-center">Позицій</th>
                <th className="px-4 py-3 font-medium text-center">Статус</th>
                <th className="px-4 py-3 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {ordersList.map((order) => (
                <tr
                  key={order.orderId}
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-dark-700/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-neon-cyan font-medium">
                        #{order.orderId}
                      </span>
                      {order.isAssignedToMe && (
                        <span className="px-1.5 py-0.5 bg-neon-cyan/20 text-neon-cyan text-xs rounded">
                          Ваше
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white">{order.buyerDiscordNick}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-gray-400">{order.items.length}</span>
                      {order.myClaimedItemCount > 0 && (
                        <span className="text-xs text-neon-cyan">
                          {order.myClaimedItemCount} ваших
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("uk-UA")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Seller dashboard
  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">Кабінет продавця</h1>
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Переглянути каталог
              </a>
            </div>

            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <span className="text-green-400">{stats.inStock} в наявності</span>
                <span className="text-gray-500">{stats.outOfStock} немає</span>
                <span className="text-neon-cyan">{stats.totalQty} всього</span>
              </div>

              {/* User info */}
              {seller && (
                <span className="text-sm text-gray-400 border-l border-dark-600 pl-4">
                  {seller.discordId}
                </span>
              )}

              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Вийти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setActiveTab("inventory"); setSelectedOrder(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "inventory"
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                : "bg-dark-800 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
            }`}
          >
            Інвентар
          </button>
          <button
            onClick={() => { setActiveTab("orders"); setSelectedOrder(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "orders"
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                : "bg-dark-800 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
            }`}
          >
            Замовлення
            {orders.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-neon-cyan/30 rounded text-xs">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("archived"); setSelectedOrder(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "archived"
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                : "bg-dark-800 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
            }`}
          >
            Архів
          </button>
        </div>

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <>
            <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
              <p className="text-sm text-gray-400">
                Керуйте інвентарем ваших креслень нижче. Ви можете змінювати лише кількість.
              </p>
            </div>

            {/* Controls */}
            <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Пошук за назвою або ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  {(["all", "instock", "outofstock"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setAvailabilityFilter(filter)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        availabilityFilter === filter
                          ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                          : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
                      }`}
                    >
                      {filter === "all" ? "Всі" : filter === "instock" ? "В наявності" : "Немає"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    categoryFilter === null
                      ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/40"
                      : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-purple/30"
                  }`}
                >
                  Всі типи
                </button>
                {BLUEPRINT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setCategoryFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      categoryFilter === type
                        ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/40"
                        : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-purple/30"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="mt-3 text-sm text-gray-500">
                Показано {filteredBlueprints.length} з {blueprints.length} креслень
              </div>
            </div>

            {/* Pending changes bar */}
            {pendingChanges.size > 0 && (
              <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-neon-cyan/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="text-neon-cyan font-medium">{pendingChanges.size}</span>
                  <span className="text-gray-400 ml-1">незбережених змін</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetChanges}
                    className="px-4 py-2 bg-dark-700 text-gray-300 border border-dark-600 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
                  >
                    Скинути
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Збереження..." : "Зберегти зміни"}
                  </button>
                </div>
              </div>
            )}

            {saveMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                saveMessage.includes("вдалося") || saveMessage.includes("дозволу")
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
              }`}>
                {saveMessage}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
                <button onClick={fetchInventory} className="ml-2 underline hover:no-underline">
                  Спробувати ще
                </button>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12 text-gray-400">Завантаження інвентарю...</div>
            )}

            {!isLoading && (
              <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-dark-700 text-left text-sm text-gray-400">
                        <th className="px-4 py-3 font-medium">Креслення</th>
                        <th className="px-4 py-3 font-medium w-24">Тип</th>
                        <th className="px-4 py-3 font-medium w-40 text-center">Кількість</th>
                        <th className="px-4 py-3 font-medium w-24 text-center">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-600">
                      {filteredBlueprints.map((bp) => {
                        const quantity = getCurrentQuantity(bp);
                        const hasChanges = pendingChanges.has(bp.id);

                        return (
                          <tr
                            key={bp.id}
                            className={`hover:bg-dark-700/50 transition-colors ${
                              hasChanges ? "bg-neon-cyan/5" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {bp.image && (
                                  <img
                                    src={bp.image}
                                    alt=""
                                    className="w-10 h-10 rounded object-cover bg-dark-600"
                                  />
                                )}
                                <div>
                                  <div className="text-white font-medium">{bp.name}</div>
                                  <div className="text-xs text-gray-500">{bp.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-400">{bp.type}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => updateQuantity(bp.id, quantity - 1)}
                                  disabled={quantity <= 0}
                                  className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={quantity}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                    updateQuantity(bp.id, isNaN(val) ? 0 : val);
                                  }}
                                  min="0"
                                  className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-center text-white focus:border-neon-cyan/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() => updateQuantity(bp.id, quantity + 1)}
                                  className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    quantity > 0
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-gray-500/20 text-gray-400"
                                  }`}
                                >
                                  {quantity > 0 ? "В наявності" : "Немає"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredBlueprints.length === 0 && !isLoading && (
                  <div className="text-center py-12 text-gray-500">
                    Не знайдено креслень за вашими фільтрами
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <>
            {selectedOrder ? (
              renderOrderDetail(selectedOrder, false)
            ) : (
              <>
                <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      Активні замовлення. Прийміть позиції, які можете виконати.
                    </p>
                    <button
                      onClick={() => fetchOrders(false)}
                      disabled={ordersLoading}
                      className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors disabled:opacity-50"
                    >
                      {ordersLoading ? "Оновлення..." : "Оновити"}
                    </button>
                  </div>
                </div>

                {ordersError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {ordersError}
                    <button onClick={() => fetchOrders(false)} className="ml-2 underline hover:no-underline">
                      Спробувати ще
                    </button>
                  </div>
                )}

                {renderOrdersList(orders, false)}
              </>
            )}
          </>
        )}

        {/* Archived Tab */}
        {activeTab === "archived" && (
          <>
            {selectedOrder ? (
              renderOrderDetail(selectedOrder, true)
            ) : (
              <>
                <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      Закриті та скасовані замовлення.
                    </p>
                    <button
                      onClick={() => fetchOrders(true)}
                      disabled={ordersLoading}
                      className="text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors disabled:opacity-50"
                    >
                      {ordersLoading ? "Оновлення..." : "Оновити"}
                    </button>
                  </div>
                </div>

                {ordersError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {ordersError}
                    <button onClick={() => fetchOrders(true)} className="ml-2 underline hover:no-underline">
                      Спробувати ще
                    </button>
                  </div>
                )}

                {renderOrdersList(archivedOrders, true)}
              </>
            )}
          </>
        )}
      </main>

      {/* Copy toast notification */}
      {copyToast && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-green-500/90 text-white rounded-lg shadow-lg text-sm font-medium animate-fade-in z-50">
          {copyToast}
        </div>
      )}
    </div>
  );
}
