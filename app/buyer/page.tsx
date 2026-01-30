"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type OrderStatus = "open" | "in_progress" | "completed" | "closed" | "cancelled";
type ItemClaimStatus = "unclaimed" | "claimed" | "fulfilled";
type OrderFilter = "all" | "active" | "archived";

interface OrderItem {
  blueprintId: string;
  blueprintName: string;
  requestedQty: number;
  claimStatus: ItemClaimStatus;
  claimedBySellerDiscordId?: string;
  publicNoteSnapshot?: string | null;
}

interface BuyerOrder {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  notes?: string;
  isMultiSeller: boolean;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  totalItems: number;
  claimedItems: number;
  fulfilledItems: number;
  assignedSellerDiscordId?: string;
}

// Status display config
const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  open: {
    label: "Нове",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  in_progress: {
    label: "В обробці",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  completed: {
    label: "Завершено",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  closed: {
    label: "Закрито",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
  },
  cancelled: {
    label: "Скасовано",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
};

// Item status display config
const ITEM_STATUS_CONFIG: Record<
  ItemClaimStatus,
  { label: string; color: string }
> = {
  unclaimed: { label: "Очікує", color: "text-gray-400" },
  claimed: { label: "Прийнято", color: "text-yellow-400" },
  fulfilled: { label: "Виконано", color: "text-green-400" },
};

export default function BuyerDashboard() {
  const router = useRouter();
  const { isAuthenticated, role, user, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/buyer/orders?filter=${filter}`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth?mode=login&role=buyer");
          return;
        }
        throw new Error("Failed to fetch orders");
      }

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Не вдалося завантажити замовлення");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  // Check auth and fetch orders
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || role !== "buyer") {
      router.push("/auth?mode=login&role=buyer");
      return;
    }

    fetchOrders();
  }, [authLoading, isAuthenticated, role, fetchOrders, router]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Toggle order expansion
  const toggleOrder = (orderId: string) => {
    setExpandedOrder((prev) => (prev === orderId ? null : orderId));
  };

  // Loading state
  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-cyan transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          На головну
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Кабінет покупця</h1>
        <p className="text-gray-400">
          Перегляд ваших замовлень та їх статусів
        </p>

        {/* User info */}
        {user && (
          <div className="mt-4 p-3 bg-dark-800 rounded-lg border border-dark-600 inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neon-cyan/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Discord ID</p>
              <p className="font-medium text-white">{user.discordId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "active", "archived"] as OrderFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-dark-500"
            }`}
          >
            {f === "all" ? "Всі" : f === "active" ? "Активні" : "Архів"}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-dark-800 rounded-lg border border-dark-600 p-4 animate-pulse">
              <div className="h-5 bg-dark-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-dark-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            {filter === "all"
              ? "Замовлень поки немає"
              : filter === "active"
              ? "Немає активних замовлень"
              : "Немає архівних замовлень"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Зробіть перше замовлення на сторінці каталогу
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg hover:bg-neon-cyan/30 transition-colors"
          >
            Перейти до каталогу
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status];
            const isExpanded = expandedOrder === order.orderId;

            return (
              <div
                key={order.orderId}
                className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden"
              >
                {/* Order header - clickable */}
                <button
                  onClick={() => toggleOrder(order.orderId)}
                  className="w-full p-4 text-left hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Order ID and status */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-gray-400 break-all">
                          {order.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor} border`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Summary */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          {order.totalItems} позицій
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">
                          {formatDate(order.createdAt)}
                        </span>
                        {order.assignedSellerDiscordId && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span className="text-neon-purple">
                              Продавець: {order.assignedSellerDiscordId}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <span>Прогрес:</span>
                          <span>
                            {order.fulfilledItems}/{order.totalItems} виконано
                          </span>
                        </div>
                        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full transition-all"
                            style={{
                              width: `${(order.fulfilledItems / order.totalItems) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expand icon */}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-dark-600 p-4">
                    {/* Offer */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-1">
                        Ваша пропозиція:
                      </h4>
                      <p className="text-white">{order.offer}</p>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-1">
                          Примітки:
                        </h4>
                        <p className="text-gray-300 text-sm">{order.notes}</p>
                      </div>
                    )}

                    {/* Items */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">
                        Позиції:
                      </h4>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => {
                          const itemStatusConfig = ITEM_STATUS_CONFIG[item.claimStatus];
                          return (
                            <div
                              key={idx}
                              className="p-3 bg-dark-700 rounded-lg"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-white">
                                    {item.blueprintName}
                                  </span>
                                  <span className="text-gray-500">
                                    ×{item.requestedQty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {item.claimedBySellerDiscordId && (
                                    <span className="text-xs text-gray-500">
                                      {item.claimedBySellerDiscordId}
                                    </span>
                                  )}
                                  <span className={`text-sm ${itemStatusConfig.color}`}>
                                    {itemStatusConfig.label}
                                  </span>
                                </div>
                              </div>
                              {item.publicNoteSnapshot && (
                                <p className="mt-1.5 text-xs text-gray-500 border-l-2 border-neon-purple/30 pl-2">
                                  {item.publicNoteSnapshot}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh button */}
      {orders.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loading ? "Оновлення..." : "Оновити список"}
          </button>
        </div>
      )}
    </div>
  );
}
