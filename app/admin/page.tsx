"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Blueprint, BLUEPRINT_TYPES, BlueprintType, SellerStatus, SELLER_STATUSES } from "@/lib/types";

interface BlueprintWithMeta extends Blueprint {
  updatedAt?: string;
}

interface PendingChange {
  owned: boolean;
  ownedQty: number;
}

interface SellerData {
  id: string;
  discordId: string;
  status: SellerStatus;
  telegramChatId?: string;
  createdAt: string;
  updatedAt: string;
  inventoryCount: number;
  totalItems: number;
}

interface SellerInventoryItem {
  id: string;
  name: string;
  slug: string;
  image: string;
  type: BlueprintType;
  quantity: number;
}

type AdminTab = "blueprints" | "sellers" | "orders";

type OrdersFilter = "all" | "active" | "archived";

interface AdminOrderItem {
  blueprintId: string;
  blueprintName: string;
  requestedQty: number;
  claimStatus: "unclaimed" | "claimed" | "fulfilled";
  claimedBySellerId?: string;
  claimedBySellerDiscordId?: string;
  claimedQuantity?: number;
  claimedAt?: string;
  fulfilledAt?: string;
}

interface AdminOrder {
  orderId: string;
  buyerDiscordNick: string;
  offer: string;
  notes?: string;
  isMultiSeller: boolean;
  createdAt: string;
  status: "open" | "in_progress" | "completed" | "closed" | "cancelled";
  assignedSellerId?: string;
  assignedSellerDiscordId?: string;
  assignedAt?: string;
  closedAt?: string;
  closedBySellerId?: string;
  items: AdminOrderItem[];
}

export default function AdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>("sellers");

  // Blueprints state
  const [blueprints, setBlueprints] = useState<BlueprintWithMeta[]>([]);
  const [isLoadingBlueprints, setIsLoadingBlueprints] = useState(false);
  const [blueprintError, setBlueprintError] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSavingBlueprints, setIsSavingBlueprints] = useState(false);
  const [blueprintSaveMessage, setBlueprintSaveMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Blueprint filters
  const [bpSearch, setBpSearch] = useState("");
  const [bpCategoryFilter, setBpCategoryFilter] = useState<BlueprintType | null>(null);
  const [bpAvailabilityFilter, setBpAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  // Sellers state
  const [sellers, setSellers] = useState<SellerData[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);
  const [sellerError, setSellerError] = useState("");
  const [sellerMessage, setSellerMessage] = useState("");

  // New seller form
  const [newSellerDiscordId, setNewSellerDiscordId] = useState("");
  const [isCreatingSeller, setIsCreatingSeller] = useState(false);

  // Edit seller modal
  const [editingSeller, setEditingSeller] = useState<SellerData | null>(null);
  const [editDiscordId, setEditDiscordId] = useState("");
  const [editTelegramChatId, setEditTelegramChatId] = useState("");
  const [editStatus, setEditStatus] = useState<SellerStatus>("pending_verification");
  const [isSavingSeller, setIsSavingSeller] = useState(false);

  // Seller inventory modal
  const [viewingSellerInventory, setViewingSellerInventory] = useState<SellerData | null>(null);
  const [sellerInventory, setSellerInventory] = useState<SellerInventoryItem[]>([]);
  const [isLoadingSellerInventory, setIsLoadingSellerInventory] = useState(false);
  const [sellerInventoryChanges, setSellerInventoryChanges] = useState<Map<string, number>>(new Map());
  const [isSavingSellerInventory, setIsSavingSellerInventory] = useState(false);
  const [sellerInventorySearch, setSellerInventorySearch] = useState("");

  // Orders state
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersMessage, setOrdersMessage] = useState("");
  const [ordersFilter, setOrdersFilter] = useState<OrdersFilter>("active");
  const [isClearingOrders, setIsClearingOrders] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchSellers();
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPassword("");
        fetchSellers();
      } else {
        setAuthError(data.error || "Помилка входу");
      }
    } catch {
      setAuthError("Помилка з'єднання");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      setIsAuthenticated(false);
      setBlueprints([]);
      setSellers([]);
      setPendingChanges(new Map());
    }
  };

  // ============================================
  // BLUEPRINTS (Legacy - for backward compatibility)
  // ============================================

  const fetchBlueprints = async () => {
    setIsLoadingBlueprints(true);
    setBlueprintError("");

    try {
      const res = await fetch("/api/admin/blueprints");
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setBlueprints(data.blueprints || []);
    } catch {
      setBlueprintError("Не вдалося завантажити креслення");
    } finally {
      setIsLoadingBlueprints(false);
    }
  };

  const getCurrentValue = useCallback(
    (bp: BlueprintWithMeta): { owned: boolean; ownedQty: number } => {
      const pending = pendingChanges.get(bp.slug);
      if (pending) {
        return pending;
      }
      return { owned: bp.owned || false, ownedQty: bp.ownedQty || 0 };
    },
    [pendingChanges]
  );

  const updateField = useCallback(
    (slug: string, field: "owned" | "ownedQty", value: boolean | number) => {
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        const bp = blueprints.find((b) => b.slug === slug);
        if (!bp) return prev;

        const current = newMap.get(slug) || { owned: bp.owned || false, ownedQty: bp.ownedQty || 0 };

        if (field === "owned") {
          const newOwned = value as boolean;
          newMap.set(slug, {
            owned: newOwned,
            ownedQty: newOwned ? Math.max(1, current.ownedQty) : 0,
          });
        } else {
          let newQty = value as number;
          newQty = Math.max(0, Math.floor(newQty));
          newMap.set(slug, {
            ...current,
            ownedQty: newQty,
            owned: newQty > 0 ? true : current.owned,
          });
        }

        const updated = newMap.get(slug)!;
        if (updated.owned === (bp.owned || false) && updated.ownedQty === (bp.ownedQty || 0)) {
          newMap.delete(slug);
        }

        return newMap;
      });
      setBlueprintSaveMessage("");
    },
    [blueprints]
  );

  const resetChanges = useCallback(() => {
    setPendingChanges(new Map());
    setBlueprintSaveMessage("");
  }, []);

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSavingBlueprints(true);
    setBlueprintSaveMessage("");

    const updates = Array.from(pendingChanges.entries()).map(([slug, changes]) => ({
      slug,
      owned: changes.owned,
      ownedQty: changes.ownedQty,
    }));

    try {
      const res = await fetch("/api/admin/blueprints", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Save failed");
      }

      const data = await res.json();

      if (data.success && data.updatedAt) {
        setLastSavedAt(data.updatedAt);
        setBlueprintSaveMessage(`${data.message} о ${new Date(data.updatedAt).toLocaleTimeString()}`);
      } else {
        setBlueprintSaveMessage(data.message || "Зміни збережено");
      }

      await fetchBlueprints();
      setPendingChanges(new Map());
    } catch {
      setBlueprintSaveMessage("Не вдалося зберегти зміни");
    } finally {
      setIsSavingBlueprints(false);
    }
  };

  const filteredBlueprints = useMemo(() => {
    let result = blueprints;

    if (bpCategoryFilter) {
      result = result.filter((bp) => bp.type === bpCategoryFilter);
    }

    if (bpAvailabilityFilter !== "all") {
      result = result.filter((bp) => {
        const { owned } = getCurrentValue(bp);
        return bpAvailabilityFilter === "available" ? owned : !owned;
      });
    }

    if (bpSearch.trim()) {
      const query = bpSearch.toLowerCase().trim();
      result = result.filter(
        (bp) =>
          bp.name.toLowerCase().includes(query) ||
          bp.id.toLowerCase().includes(query) ||
          bp.slug.toLowerCase().includes(query)
      );
    }

    return result;
  }, [blueprints, bpCategoryFilter, bpAvailabilityFilter, bpSearch, getCurrentValue]);

  const bpStats = useMemo(() => {
    let available = 0;
    let unavailable = 0;
    let totalQty = 0;

    for (const bp of blueprints) {
      const { owned, ownedQty } = getCurrentValue(bp);
      if (owned) {
        available++;
        totalQty += ownedQty;
      } else {
        unavailable++;
      }
    }

    return { available, unavailable, totalQty };
  }, [blueprints, getCurrentValue]);

  // ============================================
  // SELLERS
  // ============================================

  const fetchSellers = async () => {
    setIsLoadingSellers(true);
    setSellerError("");

    try {
      const res = await fetch("/api/admin/sellers");
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setSellers(data.sellers || []);
    } catch {
      setSellerError("Не вдалося завантажити продавців");
    } finally {
      setIsLoadingSellers(false);
    }
  };

  const createSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerDiscordId.trim()) return;

    setIsCreatingSeller(true);
    setSellerMessage("");

    try {
      const res = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId: newSellerDiscordId.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSellerMessage("Продавця успішно створено");
        setNewSellerDiscordId("");
        fetchSellers();
      } else {
        setSellerMessage(data.error || "Не вдалося створити продавця");
      }
    } catch {
      setSellerMessage("Помилка з'єднання");
    } finally {
      setIsCreatingSeller(false);
    }
  };

  const openEditSeller = (seller: SellerData) => {
    setEditingSeller(seller);
    setEditDiscordId(seller.discordId);
    setEditTelegramChatId(seller.telegramChatId || "");
    setEditStatus(seller.status);
  };

  const closeEditSeller = () => {
    setEditingSeller(null);
    setEditDiscordId("");
    setEditTelegramChatId("");
    setEditStatus("pending_verification");
  };

  const saveSellerChanges = async () => {
    if (!editingSeller) return;

    setIsSavingSeller(true);

    try {
      // Update Discord ID if changed
      if (editDiscordId.trim() !== editingSeller.discordId) {
        const res = await fetch("/api/admin/sellers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerId: editingSeller.id,
            action: "updateDiscordId",
            value: editDiscordId.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSellerMessage(data.error || "Не вдалося оновити Discord ID");
          setIsSavingSeller(false);
          return;
        }
      }

      // Update Telegram Chat ID if changed
      if (editTelegramChatId.trim() !== (editingSeller.telegramChatId || "")) {
        await fetch("/api/admin/sellers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerId: editingSeller.id,
            action: "updateTelegramChatId",
            value: editTelegramChatId.trim(),
          }),
        });
      }

      // Update status if changed
      if (editStatus !== editingSeller.status) {
        await fetch("/api/admin/sellers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerId: editingSeller.id,
            action: "updateStatus",
            value: editStatus,
          }),
        });
      }

      setSellerMessage("Продавця успішно оновлено");
      closeEditSeller();
      fetchSellers();
    } catch {
      setSellerMessage("Не вдалося оновити продавця");
    } finally {
      setIsSavingSeller(false);
    }
  };

  const deleteSeller = async (sellerId: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цього продавця? Це неможливо скасувати.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sellers?id=${sellerId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSellerMessage("Продавця видалено");
        fetchSellers();
      } else {
        const data = await res.json();
        setSellerMessage(data.error || "Не вдалося видалити продавця");
      }
    } catch {
      setSellerMessage("Помилка з'єднання");
    }
  };

  // Seller inventory
  const openSellerInventory = async (seller: SellerData) => {
    setViewingSellerInventory(seller);
    setSellerInventoryChanges(new Map());
    setSellerInventorySearch("");
    setIsLoadingSellerInventory(true);

    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/inventory`);
      if (res.ok) {
        const data = await res.json();
        setSellerInventory(data.blueprints || []);
      }
    } catch {
      // Error handling
    } finally {
      setIsLoadingSellerInventory(false);
    }
  };

  const closeSellerInventory = () => {
    setViewingSellerInventory(null);
    setSellerInventory([]);
    setSellerInventoryChanges(new Map());
  };

  const updateSellerInventoryItem = (blueprintId: string, quantity: number) => {
    setSellerInventoryChanges((prev) => {
      const newMap = new Map(prev);
      const original = sellerInventory.find((bp) => bp.id === blueprintId);
      const newQty = Math.max(0, Math.floor(quantity));

      if (original && newQty === original.quantity) {
        newMap.delete(blueprintId);
      } else {
        newMap.set(blueprintId, newQty);
      }

      return newMap;
    });
  };

  const getSellerInventoryQty = (bp: SellerInventoryItem): number => {
    return sellerInventoryChanges.has(bp.id) ? sellerInventoryChanges.get(bp.id)! : bp.quantity;
  };

  const saveSellerInventory = async () => {
    if (!viewingSellerInventory || sellerInventoryChanges.size === 0) return;

    setIsSavingSellerInventory(true);

    const updates = Array.from(sellerInventoryChanges.entries()).map(([blueprintId, quantity]) => ({
      blueprintId,
      quantity,
    }));

    try {
      const res = await fetch(`/api/admin/sellers/${viewingSellerInventory.id}/inventory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        // Refresh inventory
        const refreshRes = await fetch(`/api/admin/sellers/${viewingSellerInventory.id}/inventory`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setSellerInventory(data.blueprints || []);
        }
        setSellerInventoryChanges(new Map());
        fetchSellers(); // Update seller stats
      }
    } catch {
      // Error handling
    } finally {
      setIsSavingSellerInventory(false);
    }
  };

  const filteredSellerInventory = useMemo(() => {
    if (!sellerInventorySearch.trim()) return sellerInventory;
    const query = sellerInventorySearch.toLowerCase();
    return sellerInventory.filter(
      (bp) => bp.name.toLowerCase().includes(query) || bp.id.toLowerCase().includes(query)
    );
  }, [sellerInventory, sellerInventorySearch]);

  const getStatusBadgeClass = (status: SellerStatus) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/40";
      case "pending_verification":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
      case "banned":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      case "disabled":
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
    }
  };

  // Quick action to approve a pending seller
  const approveSeller = async (sellerId: string) => {
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          action: "updateStatus",
          value: "active",
        }),
      });
      if (res.ok) {
        setSellerMessage("Продавця підтверджено та активовано");
        fetchSellers();
      } else {
        const data = await res.json();
        setSellerMessage(data.error || "Не вдалося підтвердити продавця");
      }
    } catch {
      setSellerMessage("Помилка з'єднання");
    }
  };

  // Quick action to ban a seller
  const banSeller = async (sellerId: string) => {
    if (!confirm("Ви впевнені, що хочете заблокувати цього продавця?")) return;
    try {
      const res = await fetch("/api/admin/sellers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          action: "updateStatus",
          value: "banned",
        }),
      });
      if (res.ok) {
        setSellerMessage("Продавця заблоковано");
        fetchSellers();
      } else {
        const data = await res.json();
        setSellerMessage(data.error || "Не вдалося заблокувати продавця");
      }
    } catch {
      setSellerMessage("Помилка з'єднання");
    }
  };

  // Count pending sellers
  const pendingSellersCount = useMemo(() => {
    return sellers.filter(s => s.status === "pending_verification").length;
  }, [sellers]);

  // ============================================
  // ORDERS
  // ============================================

  const fetchOrders = useCallback(async (filter: OrdersFilter = ordersFilter) => {
    setIsLoadingOrders(true);
    setOrdersError("");

    try {
      const res = await fetch(`/api/admin/orders?filter=${filter}`);
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrdersError("Не вдалося завантажити замовлення");
    } finally {
      setIsLoadingOrders(false);
    }
  }, [ordersFilter]);

  const handleOrdersFilterChange = (filter: OrdersFilter) => {
    setOrdersFilter(filter);
    fetchOrders(filter);
  };

  const clearAllOrdersAction = async () => {
    if (!confirm("Ви впевнені, що хочете видалити ВСІ замовлення? Цю дію неможливо скасувати!")) {
      return;
    }

    // Double confirmation for safety
    if (!confirm("Це видалить усі активні та архівні замовлення. Продовжити?")) {
      return;
    }

    setIsClearingOrders(true);
    setOrdersMessage("");

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearAll" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOrdersMessage(`Успішно видалено ${data.deletedCount} замовлень`);
        setOrders([]);
        setExpandedOrders(new Set());
      } else {
        setOrdersMessage(data.error || "Не вдалося очистити замовлення");
      }
    } catch {
      setOrdersMessage("Помилка з'єднання");
    } finally {
      setIsClearingOrders(false);
    }
  };

  const closeOrderAction = async (orderId: string) => {
    if (!confirm("Закрити це замовлення?")) return;

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", orderId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOrdersMessage("Замовлення закрито");
        fetchOrders();
      } else {
        setOrdersMessage(data.error || "Не вдалося закрити замовлення");
      }
    } catch {
      setOrdersMessage("Помилка з'єднання");
    }
  };

  const cancelOrderAction = async (orderId: string) => {
    if (!confirm("Скасувати це замовлення?")) return;

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", orderId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOrdersMessage("Замовлення скасовано");
        fetchOrders();
      } else {
        setOrdersMessage(data.error || "Не вдалося скасувати замовлення");
      }
    } catch {
      setOrdersMessage("Помилка з'єднання");
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getOrderStatusBadge = (status: AdminOrder["status"]) => {
    switch (status) {
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/40";
      case "closed":
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
      case "cancelled":
        return "bg-red-500/20 text-red-400 border-red-500/40";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
    }
  };

  const getClaimStatusBadge = (status: AdminOrderItem["claimStatus"]) => {
    switch (status) {
      case "unclaimed":
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
      case "claimed":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
      case "fulfilled":
        return "bg-green-500/20 text-green-400 border-green-500/40";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/40";
    }
  };

  const getStatusLabel = (status: AdminOrder["status"]) => {
    switch (status) {
      case "open": return "Відкрите";
      case "in_progress": return "В обробці";
      case "completed": return "Виконано";
      case "closed": return "Закрите";
      case "cancelled": return "Скасовано";
      default: return status;
    }
  };

  const getClaimStatusLabel = (status: AdminOrderItem["claimStatus"]) => {
    switch (status) {
      case "unclaimed": return "Не прийнято";
      case "claimed": return "Прийнято";
      case "fulfilled": return "Виконано";
      default: return status;
    }
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
            <h1 className="text-xl font-bold text-white mb-6 text-center">Вхід адміністратора</h1>

            <form onSubmit={handleLogin}>
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
                  placeholder="Введіть пароль адміністратора"
                  autoFocus
                />
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || !password}
                className="w-full py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? "Вхід..." : "Увійти"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">Панель адміністратора</h1>
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Переглянути сайт
              </a>
            </div>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Вийти
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 border-b border-dark-600">
          <button
            onClick={() => setActiveTab("sellers")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "sellers"
                ? "text-neon-cyan border-neon-cyan"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            Продавці
          </button>
          <button
            onClick={() => {
              setActiveTab("orders");
              if (orders.length === 0) fetchOrders();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "orders"
                ? "text-neon-cyan border-neon-cyan"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            Замовлення
          </button>
          <button
            onClick={() => {
              setActiveTab("blueprints");
              if (blueprints.length === 0) fetchBlueprints();
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "blueprints"
                ? "text-neon-cyan border-neon-cyan"
                : "text-gray-400 border-transparent hover:text-white"
            }`}
          >
            Креслення (Застаріле)
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* SELLERS TAB */}
        {activeTab === "sellers" && (
          <div>
            {/* Create seller form */}
            <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
              <h2 className="text-lg font-medium text-white mb-4">Додати нового продавця</h2>
              <form onSubmit={createSeller} className="flex gap-4">
                <input
                  type="text"
                  value={newSellerDiscordId}
                  onChange={(e) => setNewSellerDiscordId(e.target.value)}
                  placeholder="Discord username або ID"
                  className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isCreatingSeller || !newSellerDiscordId.trim()}
                  className="px-6 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
                >
                  {isCreatingSeller ? "Створення..." : "Додати продавця"}
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500">
                Нові продавці неактивні за замовчуванням і не можуть отримати доступ до панелі, поки їх не активовано.
              </p>
            </div>

            {/* Pending verification alert */}
            {pendingSellersCount > 0 && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <span className="text-yellow-400 font-bold">{pendingSellersCount}</span>
                  </div>
                  <div>
                    <p className="text-yellow-400 font-medium">
                      {pendingSellersCount} продавц{pendingSellersCount === 1 ? "ь" : "ів"} очікує підтвердження
                    </p>
                    <p className="text-sm text-yellow-400/70">Перегляньте та підтвердіть нові реєстрації продавців нижче</p>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            {sellerMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                sellerMessage.includes("вдалося") || sellerMessage.includes("помилка")
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
              }`}>
                {sellerMessage}
              </div>
            )}

            {sellerError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {sellerError}
                <button onClick={fetchSellers} className="ml-2 underline">Спробувати ще</button>
              </div>
            )}

            {/* Sellers list */}
            {isLoadingSellers ? (
              <div className="text-center py-12 text-gray-400">Завантаження продавців...</div>
            ) : (
              <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-dark-700 text-left text-sm text-gray-400">
                      <th className="px-4 py-3 font-medium">Discord ID</th>
                      <th className="px-4 py-3 font-medium w-28">Статус</th>
                      <th className="px-4 py-3 font-medium w-36">Telegram</th>
                      <th className="px-4 py-3 font-medium w-24 text-center">Товари</th>
                      <th className="px-4 py-3 font-medium w-32">Створено</th>
                      <th className="px-4 py-3 font-medium w-48 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-600">
                    {sellers.map((seller) => (
                      <tr key={seller.id} className="hover:bg-dark-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{seller.discordId}</div>
                          <div className="text-xs text-gray-500">{seller.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(seller.status)}`}>
                            {seller.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {seller.telegramChatId ? (
                            <span className="text-sm text-gray-300">{seller.telegramChatId}</span>
                          ) : (
                            <span className="text-sm text-gray-500">Не вказано</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-300">
                            {seller.inventoryCount} ({seller.totalItems})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-400">
                            {new Date(seller.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {seller.status === "pending_verification" && (
                              <button
                                onClick={() => approveSeller(seller.id)}
                                className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors"
                              >
                                Підтвердити
                              </button>
                            )}
                            {seller.status !== "banned" && seller.status !== "pending_verification" && (
                              <button
                                onClick={() => banSeller(seller.id)}
                                className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                              >
                                Заблокувати
                              </button>
                            )}
                            <button
                              onClick={() => openSellerInventory(seller)}
                              className="px-3 py-1 bg-dark-600 text-gray-300 rounded text-xs hover:bg-dark-500 transition-colors"
                            >
                              Інвентар
                            </button>
                            <button
                              onClick={() => openEditSeller(seller)}
                              className="px-3 py-1 bg-neon-cyan/20 text-neon-cyan rounded text-xs hover:bg-neon-cyan/30 transition-colors"
                            >
                              Редагувати
                            </button>
                            <button
                              onClick={() => deleteSeller(seller.id)}
                              className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                            >
                              Видалити
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {sellers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Продавців поки немає. Додайте одного вище.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            {/* Header with filters and clear button */}
            <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-2">
                  {(["active", "archived", "all"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleOrdersFilterChange(filter)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        ordersFilter === filter
                          ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                          : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
                      }`}
                    >
                      {filter === "active" ? "Активні" : filter === "archived" ? "Архівні" : "Усі"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={clearAllOrdersAction}
                  disabled={isClearingOrders}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {isClearingOrders ? "Очищення..." : "Очистити всі замовлення"}
                </button>
              </div>
            </div>

            {/* Messages */}
            {ordersMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                ordersMessage.includes("вдалося") || ordersMessage.includes("помилка")
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
              }`}>
                {ordersMessage}
              </div>
            )}

            {ordersError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {ordersError}
                <button onClick={() => fetchOrders()} className="ml-2 underline">Спробувати ще</button>
              </div>
            )}

            {/* Orders list */}
            {isLoadingOrders ? (
              <div className="text-center py-12 text-gray-400">Завантаження замовлень...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {ordersFilter === "active" ? "Немає активних замовлень" :
                 ordersFilter === "archived" ? "Немає архівних замовлень" : "Замовлень немає"}
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const isExpanded = expandedOrders.has(order.orderId);

                  return (
                    <div
                      key={order.orderId}
                      className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden"
                    >
                      {/* Order header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-dark-700/50 transition-colors"
                        onClick={() => toggleOrderExpanded(order.orderId)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-lg">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">
                                  {order.buyerDiscordNick}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getOrderStatusBadge(order.status)}`}>
                                  {getStatusLabel(order.status)}
                                </span>
                                {order.isMultiSeller && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/40">
                                    Мульти
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 mt-1">
                                ID: {order.orderId.slice(0, 8)}... •{" "}
                                {new Date(order.createdAt).toLocaleString()} •{" "}
                                {order.items.length} позиц{order.items.length === 1 ? "ія" : order.items.length < 5 ? "ії" : "ій"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {order.status !== "closed" && order.status !== "cancelled" && (
                              <>
                                <button
                                  onClick={() => closeOrderAction(order.orderId)}
                                  className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30 transition-colors"
                                >
                                  Закрити
                                </button>
                                <button
                                  onClick={() => cancelOrderAction(order.orderId)}
                                  className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                                >
                                  Скасувати
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-dark-600 p-4 bg-dark-700/30">
                          {/* Buyer info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-xs text-gray-500 uppercase mb-1">Discord покупця</div>
                              <div className="text-white font-mono bg-dark-700 px-3 py-2 rounded overflow-wrap-anywhere">
                                {order.buyerDiscordNick}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 uppercase mb-1">Пропозиція</div>
                              <div className="text-white bg-dark-700 px-3 py-2 rounded overflow-wrap-anywhere">
                                {order.offer}
                              </div>
                            </div>
                          </div>

                          {order.notes && (
                            <div className="mb-4">
                              <div className="text-xs text-gray-500 uppercase mb-1">Примітки</div>
                              <div className="text-gray-300 bg-dark-700 px-3 py-2 rounded overflow-wrap-anywhere">
                                {order.notes}
                              </div>
                            </div>
                          )}

                          {order.assignedSellerDiscordId && (
                            <div className="mb-4">
                              <div className="text-xs text-gray-500 uppercase mb-1">Призначений продавець</div>
                              <div className="text-neon-cyan">
                                {order.assignedSellerDiscordId}
                                {order.assignedAt && (
                                  <span className="text-gray-500 text-sm ml-2">
                                    ({new Date(order.assignedAt).toLocaleString()})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Items */}
                          <div>
                            <div className="text-xs text-gray-500 uppercase mb-2">Позиції</div>
                            <div className="bg-dark-700 rounded overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-dark-600 text-left text-gray-400">
                                    <th className="px-3 py-2 font-medium">Креслення</th>
                                    <th className="px-3 py-2 font-medium w-20 text-center">К-сть</th>
                                    <th className="px-3 py-2 font-medium w-28">Статус</th>
                                    <th className="px-3 py-2 font-medium">Продавець</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-600">
                                  {order.items.map((item) => (
                                    <tr key={item.blueprintId} className="hover:bg-dark-600/50">
                                      <td className="px-3 py-2">
                                        <div className="text-white">{item.blueprintName}</div>
                                        <div className="text-xs text-gray-500">{item.blueprintId}</div>
                                      </td>
                                      <td className="px-3 py-2 text-center text-white">
                                        {item.claimedQuantity || item.requestedQty}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getClaimStatusBadge(item.claimStatus)}`}>
                                          {getClaimStatusLabel(item.claimStatus)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        {item.claimedBySellerDiscordId ? (
                                          <div>
                                            <span className="text-neon-cyan">{item.claimedBySellerDiscordId}</span>
                                            {item.fulfilledAt && (
                                              <div className="text-xs text-gray-500">
                                                Виконано: {new Date(item.fulfilledAt).toLocaleString()}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {order.closedAt && (
                            <div className="mt-4 text-sm text-gray-500">
                              Закрито: {new Date(order.closedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BLUEPRINTS TAB (Legacy) */}
        {activeTab === "blueprints" && (
          <div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                <strong>Примітка:</strong> Це застаріла секція керування кресленнями.
                Інвентар тепер керується для кожного продавця окремо. Використовуйте вкладку Продавці для керування інвентарем продавців.
              </p>
            </div>

            {/* Controls */}
            <div className="bg-dark-800 rounded-lg p-4 mb-6 border border-dark-600">
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Пошук за назвою, ID або slug..."
                    value={bpSearch}
                    onChange={(e) => setBpSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  {(["all", "available", "unavailable"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBpAvailabilityFilter(filter)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        bpAvailabilityFilter === filter
                          ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                          : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-cyan/30"
                      }`}
                    >
                      {filter === "all" ? "Всі" : filter === "available" ? "Доступні" : "Недоступні"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setBpCategoryFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    bpCategoryFilter === null
                      ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/40"
                      : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-purple/30"
                  }`}
                >
                  Всі типи
                </button>
                {BLUEPRINT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setBpCategoryFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      bpCategoryFilter === type
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

            {/* Action bar */}
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
                    disabled={isSavingBlueprints}
                    className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {isSavingBlueprints ? "Збереження..." : "Зберегти зміни"}
                  </button>
                </div>
              </div>
            )}

            {blueprintSaveMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                blueprintSaveMessage.includes("вдалося")
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
              }`}>
                {blueprintSaveMessage}
              </div>
            )}

            {blueprintError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {blueprintError}
                <button onClick={fetchBlueprints} className="ml-2 underline">Спробувати ще</button>
              </div>
            )}

            {isLoadingBlueprints ? (
              <div className="text-center py-12 text-gray-400">Завантаження креслень...</div>
            ) : (
              <div className="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-dark-700 text-left text-sm text-gray-400">
                        <th className="px-4 py-3 font-medium">Креслення</th>
                        <th className="px-4 py-3 font-medium w-24">Тип</th>
                        <th className="px-4 py-3 font-medium w-32 text-center">Доступно</th>
                        <th className="px-4 py-3 font-medium w-40 text-center">Кількість</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-600">
                      {filteredBlueprints.map((bp) => {
                        const { owned, ownedQty } = getCurrentValue(bp);
                        const hasChanges = pendingChanges.has(bp.slug);

                        return (
                          <tr
                            key={bp.slug}
                            className={`hover:bg-dark-700/50 transition-colors ${hasChanges ? "bg-neon-cyan/5" : ""}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {bp.image && (
                                  <img src={bp.image} alt="" className="w-10 h-10 rounded object-cover bg-dark-600" />
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
                              <div className="flex justify-center">
                                <button
                                  onClick={() => updateField(bp.slug, "owned", !owned)}
                                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                                    owned
                                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                                  }`}
                                >
                                  {owned ? "Так" : "Ні"}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => updateField(bp.slug, "ownedQty", ownedQty - 1)}
                                  disabled={ownedQty <= 0}
                                  className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={ownedQty}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                    updateField(bp.slug, "ownedQty", isNaN(val) ? 0 : val);
                                  }}
                                  min="0"
                                  className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-center text-white focus:border-neon-cyan/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() => updateField(bp.slug, "ownedQty", ownedQty + 1)}
                                  className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredBlueprints.length === 0 && !isLoadingBlueprints && (
                  <div className="text-center py-12 text-gray-500">
                    Не знайдено креслень за вашими фільтрами
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Seller Modal */}
      {editingSeller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg p-6 w-full max-w-md border border-dark-600">
            <h2 className="text-lg font-bold text-white mb-4">Редагувати продавця</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Discord ID</label>
                <input
                  type="text"
                  value={editDiscordId}
                  onChange={(e) => setEditDiscordId(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={editTelegramChatId}
                  onChange={(e) => setEditTelegramChatId(e.target.value)}
                  placeholder="Для сповіщень про замовлення"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Статус</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as SellerStatus)}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:border-neon-cyan/50 focus:outline-none"
                >
                  <option value="pending_verification">Очікує підтвердження</option>
                  <option value="active">Активний</option>
                  <option value="disabled">Вимкнено</option>
                  <option value="banned">Заблоковано</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeEditSeller}
                className="px-4 py-2 bg-dark-700 text-gray-300 rounded-lg hover:bg-dark-600 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={saveSellerChanges}
                disabled={isSavingSeller}
                className="px-4 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50"
              >
                {isSavingSeller ? "Збереження..." : "Зберегти"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seller Inventory Modal */}
      {viewingSellerInventory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col border border-dark-600">
            <div className="p-4 border-b border-dark-600 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Інвентар: {viewingSellerInventory.discordId}
                </h2>
                <p className="text-sm text-gray-400">Керуйте кількістю креслень цього продавця</p>
              </div>
              <button
                onClick={closeSellerInventory}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-4 border-b border-dark-600">
              <input
                type="text"
                placeholder="Пошук креслень..."
                value={sellerInventorySearch}
                onChange={(e) => setSellerInventorySearch(e.target.value)}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
              />
            </div>

            {sellerInventoryChanges.size > 0 && (
              <div className="px-4 py-2 bg-neon-cyan/10 border-b border-neon-cyan/30 flex items-center justify-between">
                <span className="text-sm text-neon-cyan">
                  {sellerInventoryChanges.size} незбережених змін
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSellerInventoryChanges(new Map())}
                    className="px-3 py-1 bg-dark-700 text-gray-300 rounded text-sm"
                  >
                    Скинути
                  </button>
                  <button
                    onClick={saveSellerInventory}
                    disabled={isSavingSellerInventory}
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm disabled:opacity-50"
                  >
                    {isSavingSellerInventory ? "Збереження..." : "Зберегти"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {isLoadingSellerInventory ? (
                <div className="text-center py-12 text-gray-400">Завантаження інвентарю...</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-dark-700 sticky top-0">
                    <tr className="text-left text-sm text-gray-400">
                      <th className="px-4 py-3 font-medium">Креслення</th>
                      <th className="px-4 py-3 font-medium w-24">Тип</th>
                      <th className="px-4 py-3 font-medium w-40 text-center">Кількість</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-600">
                    {filteredSellerInventory.map((bp) => {
                      const quantity = getSellerInventoryQty(bp);
                      const hasChanges = sellerInventoryChanges.has(bp.id);

                      return (
                        <tr
                          key={bp.id}
                          className={`hover:bg-dark-700/50 ${hasChanges ? "bg-neon-cyan/5" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {bp.image && (
                                <img src={bp.image} alt="" className="w-8 h-8 rounded object-cover bg-dark-600" />
                              )}
                              <div>
                                <div className="text-white text-sm">{bp.name}</div>
                                <div className="text-xs text-gray-500">{bp.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-400">{bp.type}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => updateSellerInventoryItem(bp.id, quantity - 1)}
                                disabled={quantity <= 0}
                                className="w-7 h-7 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white disabled:opacity-30"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={quantity}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  updateSellerInventoryItem(bp.id, isNaN(val) ? 0 : val);
                                }}
                                min="0"
                                className="w-14 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-center text-white text-sm focus:border-neon-cyan/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => updateSellerInventoryItem(bp.id, quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
