"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { CartItem, formatItemPrice } from "@/lib/types";

// Group cart items by seller for display
interface SellerGroup {
  sellerId: string;
  sellerDiscordId: string;
  items: CartItem[];
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, updateItemOffer, clearCart, totalQuantity, totalItems } = useCart();
  const { isAuthenticated, role, user } = useAuth();

  // Form state
  const [discordNick, setDiscordNick] = useState("");
  const [globalNotes, setGlobalNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Stock issue from server
  interface StockIssue {
    blueprintId: string;
    blueprintName: string;
    sellerId: string;
    sellerDiscordId: string;
    requestedQty: number;
    availableQty: number;
  }

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);

  // Check if user is logged in as buyer
  const isLoggedInBuyer = isAuthenticated && role === "buyer" && user?.discordId;

  // Pre-fill discord for logged-in buyers
  useEffect(() => {
    if (isLoggedInBuyer && user?.discordId) {
      setDiscordNick(user.discordId);
    }
  }, [isLoggedInBuyer, user?.discordId]);

  // Group items by seller
  const sellerGroups = useMemo((): SellerGroup[] => {
    const groups = new Map<string, SellerGroup>();

    for (const item of items) {
      let group = groups.get(item.sellerId);
      if (!group) {
        group = {
          sellerId: item.sellerId,
          sellerDiscordId: item.sellerDiscordId,
          items: [],
        };
        groups.set(item.sellerId, group);
      }
      group.items.push(item);
    }

    return Array.from(groups.values());
  }, [items]);

  // Check which items are negotiable (require offer)
  const negotiableItems = useMemo(
    () => items.filter((item) => !item.priceSnapshot || item.priceSnapshot.type === "Договірна"),
    [items]
  );

  const nonNegotiableItems = useMemo(
    () => items.filter((item) => item.priceSnapshot && item.priceSnapshot.type !== "Договірна"),
    [items]
  );

  // Check if all negotiable items have offers
  const allNegotiableItemsHaveOffers = useMemo(() => {
    return negotiableItems.every(
      (item) => item.buyerOfferText && item.buyerOfferText.trim().length > 0
    );
  }, [negotiableItems]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    // Must have items
    if (items.length === 0) return false;

    // Must have discord (unless logged in)
    if (!isLoggedInBuyer && !discordNick.trim()) return false;

    // All negotiable items must have offers
    if (!allNegotiableItemsHaveOffers) return false;

    return true;
  }, [items.length, isLoggedInBuyer, discordNick, allNegotiableItemsHaveOffers]);

  // Check if a specific item has a stock issue
  const getItemStockIssue = useCallback(
    (blueprintId: string, sellerId: string) => {
      return stockIssues.find(
        (issue) => issue.blueprintId === blueprintId && issue.sellerId === sellerId
      );
    },
    [stockIssues]
  );

  // Handle offer change for an item
  const handleOfferChange = useCallback(
    (itemId: string, offer: string) => {
      updateItemOffer(itemId, offer);
    },
    [updateItemOffer]
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid || isSubmitting) return;

    // Honeypot check
    if (honeypot) {
      setSubmitError("Запит відхилено");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStockIssues([]);

    try {
      // Prepare order data
      const orderData = {
        discordNick: isLoggedInBuyer ? user?.discordId : discordNick.trim(),
        notes: globalNotes.trim() || undefined,
        items: items.map((item) => ({
          id: item.blueprintId,
          name: item.blueprintName,
          quantity: item.quantity,
          sellerId: item.sellerId,
          sellerDiscordId: item.sellerDiscordId,
          priceSnapshot: item.priceSnapshot,
          buyerOfferText: item.buyerOfferText?.trim() || undefined,
          sellerPublicNote: item.sellerPublicNote || null,
        })),
        website: honeypot, // Honeypot field
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderData),
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for structured OUT_OF_STOCK error
        if (data.code === "OUT_OF_STOCK" && data.issues && Array.isArray(data.issues)) {
          setStockIssues(data.issues);
          setSubmitError(data.error || "Деякі товари закінчились");
          return;
        }
        throw new Error(data.error || "Помилка створення замовлення");
      }

      // Success
      setSubmitSuccess(true);
      setOrderIds(data.orderIds || []);
      clearCart();

      // Redirect after delay
      setTimeout(() => {
        if (isLoggedInBuyer) {
          router.push("/buyer");
        } else {
          router.push("/");
        }
      }, 3000);
    } catch (error) {
      console.error("Checkout error:", error);
      setSubmitError(error instanceof Error ? error.message : "Помилка з'єднання");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-800 rounded-xl border border-green-500/30 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Замовлення створено!</h1>
          <p className="text-gray-400 mb-4">
            {orderIds.length > 1
              ? `Створено ${orderIds.length} замовлень для різних продавців.`
              : "Ваше замовлення успішно оформлено."}
          </p>
          {orderIds.length > 0 && (
            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">ID замовлень:</p>
              {orderIds.map((id) => (
                <p key={id} className="text-neon-cyan font-mono">{id}</p>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">
            Продавці отримали сповіщення. Очікуйте повідомлення в Discord.
          </p>
          <p className="text-xs text-gray-600 mt-4">Перенаправлення...</p>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-800 rounded-xl border border-dark-600 p-8 text-center">
          <svg
            className="w-16 h-16 mx-auto text-dark-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h1 className="text-xl font-bold text-white mb-2">Кошик порожній</h1>
          <p className="text-gray-400 mb-6">Додайте креслення до кошика, щоб оформити замовлення.</p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors"
          >
            До каталогу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад до каталогу
          </Link>
          <h1 className="text-2xl font-bold text-white">Оформлення замовлення</h1>
          <p className="text-gray-400 mt-1">
            {totalItems} {totalItems === 1 ? "позиція" : "позицій"}, {totalQuantity} шт.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Order items by seller */}
          <div className="space-y-6 mb-8">
            {sellerGroups.map((group) => (
              <div
                key={group.sellerId}
                className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden"
              >
                {/* Seller header */}
                <div className="px-4 py-3 bg-dark-700/50 border-b border-dark-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <Link
                      href={`/sellers/${group.sellerId}`}
                      className="text-white font-medium hover:text-neon-cyan transition-colors"
                      title="Переглянути профіль продавця"
                    >
                      {group.sellerDiscordId}
                    </Link>
                    <span className="text-gray-500 text-sm">
                      ({group.items.length} {group.items.length === 1 ? "позиція" : "позицій"})
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-dark-600">
                  {group.items.map((item) => {
                    const isNegotiable = !item.priceSnapshot || item.priceSnapshot.type === "Договірна";
                    const hasOffer = item.buyerOfferText && item.buyerOfferText.trim().length > 0;
                    const stockIssue = getItemStockIssue(item.blueprintId, item.sellerId);

                    return (
                      <div
                        key={item.id}
                        className={`p-4 ${stockIssue ? "bg-red-500/5 border-l-2 border-red-500" : ""}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Image */}
                          {item.blueprintImage && (
                            <img
                              src={item.blueprintImage}
                              alt=""
                              className="w-16 h-16 rounded-lg object-cover bg-dark-700 shrink-0"
                            />
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white break-words">{item.blueprintName}</h3>

                            {/* Stock issue warning */}
                            {stockIssue && (
                              <div className="mt-1 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                                Немає в наявності (є: {stockIssue.availableQty}, потрібно: {stockIssue.requestedQty})
                              </div>
                            )}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                              <span className="text-gray-400">
                                Кількість: <span className="text-white">{item.quantity}</span>
                              </span>
                              <span className="text-neon-purple">
                                {formatItemPrice(item.priceSnapshot)}
                              </span>
                            </div>

                            {/* Seller's public note */}
                            {item.sellerPublicNote && (
                              <div className="mt-2 px-3 py-1.5 bg-dark-600/50 rounded text-xs text-gray-400 border-l-2 border-neon-purple/40">
                                {item.sellerPublicNote}
                              </div>
                            )}

                            {/* Offer field */}
                            <div className="mt-3">
                              <label className="block text-sm mb-1.5">
                                {isNegotiable ? (
                                  <span className="text-yellow-400">
                                    Обов&apos;язково: вкажіть вашу пропозицію
                                  </span>
                                ) : (
                                  <span className="text-gray-400">
                                    Необов&apos;язково: якщо хочете поторгуватись — напишіть пропозицію
                                  </span>
                                )}
                              </label>
                              <textarea
                                value={item.buyerOfferText || ""}
                                onChange={(e) => handleOfferChange(item.id, e.target.value)}
                                placeholder={
                                  isNegotiable
                                    ? "Що пропонуєте взамін? (обов'язково)"
                                    : "Альтернативна пропозиція (необов'язково)"
                                }
                                rows={2}
                                className={`w-full px-3 py-2 bg-dark-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none resize-none text-sm ${
                                  isNegotiable && !hasOffer
                                    ? "border-yellow-500/50 focus:border-yellow-500"
                                    : "border-dark-600 focus:border-neon-cyan/50"
                                }`}
                              />
                              {isNegotiable && !hasOffer && (
                                <p className="text-xs text-yellow-400 mt-1">
                                  Ціна договірна — обов&apos;язково вкажіть пропозицію
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Контактні дані</h2>

            {/* Discord */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Discord нікнейм {!isLoggedInBuyer && <span className="text-red-400">*</span>}
              </label>
              {isLoggedInBuyer ? (
                <div className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white">
                  {user?.discordId}
                  <span className="text-xs text-gray-500 ml-2">(з облікового запису)</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={discordNick}
                  onChange={(e) => setDiscordNick(e.target.value)}
                  placeholder="Ваш Discord нікнейм"
                  required
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
                />
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Загальні примітки (необов&apos;язково)
              </label>
              <textarea
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                placeholder="Додаткова інформація для продавців..."
                rows={3}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none resize-none"
              />
            </div>

            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Summary and submit */}
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            {/* Summary */}
            <div className="mb-6 pb-6 border-b border-dark-600">
              <h2 className="text-lg font-bold text-white mb-3">Підсумок</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Продавців:</span>
                  <span className="text-white">{sellerGroups.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Позицій:</span>
                  <span className="text-white">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Всього одиниць:</span>
                  <span className="text-white">{totalQuantity}</span>
                </div>
                {negotiableItems.length > 0 && (
                  <div className="flex justify-between text-yellow-400">
                    <span>Договірних позицій:</span>
                    <span>{negotiableItems.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Validation messages */}
            {!allNegotiableItemsHaveOffers && negotiableItems.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Вкажіть пропозицію для всіх позицій з договірною ціною ({negotiableItems.length})
                </p>
              </div>
            )}

            {/* Stock issues error */}
            {stockIssues.length > 0 && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-red-400 font-medium">Деякі товари закінчились</span>
                </div>
                <div className="space-y-2">
                  {stockIssues.map((issue, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-dark-700 rounded text-sm">
                      <div>
                        <span className="text-white">{issue.blueprintName}</span>
                        <span className="text-gray-500 ml-2">({issue.sellerDiscordId})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-red-400">
                          Є: {issue.availableQty}, потрібно: {issue.requestedQty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Видаліть ці позиції з кошика або зменшіть кількість
                </p>
              </div>
            )}

            {/* General error */}
            {submitError && stockIssues.length === 0 && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full py-3 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Оформлення...</span>
                </>
              ) : (
                <span>Підтвердити замовлення</span>
              )}
            </button>

            {sellerGroups.length > 1 && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Буде створено {sellerGroups.length} окремих замовлень для різних продавців
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
