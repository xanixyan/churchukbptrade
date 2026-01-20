"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Blueprint, SellerListing, ItemPrice, formatItemPrice } from "@/lib/types";
import { useCart } from "@/contexts/CartContext";

interface SellerSelection {
  sellerId: string;
  sellerDiscordId: string;
  quantity: number;
  price: ItemPrice;
  maxAvailable: number;
}

interface SellerPickerModalProps {
  blueprint: Blueprint;
  isOpen: boolean;
  onClose: () => void;
  initialQuantity?: number;
}

export default function SellerPickerModal({
  blueprint,
  isOpen,
  onClose,
  initialQuantity = 1,
}: SellerPickerModalProps) {
  const { addItem } = useCart();

  const [sellers, setSellers] = useState<SellerListing[]>([]);
  const [recommendedSellerId, setRecommendedSellerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quantity to fulfill
  const [requestedQuantity, setRequestedQuantity] = useState(initialQuantity);

  // Selected sellers with quantities
  const [selections, setSelections] = useState<SellerSelection[]>([]);

  // Fetch sellers on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchSellers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/blueprints/${blueprint.id}/sellers`);
        if (!res.ok) throw new Error("Failed to fetch sellers");

        const data = await res.json();
        setSellers(data.sellers || []);
        if (data.recommendedSeller) {
          setRecommendedSellerId(data.recommendedSeller.sellerId);
        }
      } catch (err) {
        setError("Не вдалося завантажити продавців");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
    setSelections([]);
    setRequestedQuantity(initialQuantity);
  }, [isOpen, blueprint.id, initialQuantity]);

  // Calculate total selected quantity
  const totalSelectedQuantity = useMemo(
    () => selections.reduce((sum, s) => sum + s.quantity, 0),
    [selections]
  );

  // Calculate remaining quantity to select
  const remainingQuantity = requestedQuantity - totalSelectedQuantity;

  // Check if any single seller can fulfill the entire quantity
  const canSingleSellerFulfill = useMemo(
    () => sellers.some((s) => s.quantity >= requestedQuantity),
    [sellers, requestedQuantity]
  );

  // Get maximum total available across all sellers
  const maxTotalAvailable = useMemo(
    () => sellers.reduce((sum, s) => sum + s.quantity, 0),
    [sellers]
  );

  // Update seller selection
  const updateSellerSelection = useCallback(
    (sellerId: string, quantity: number) => {
      const seller = sellers.find((s) => s.sellerId === sellerId);
      if (!seller) return;

      setSelections((prev) => {
        // Remove if quantity is 0
        if (quantity <= 0) {
          return prev.filter((s) => s.sellerId !== sellerId);
        }

        // Clamp quantity to max available
        const clampedQty = Math.min(quantity, seller.quantity);

        const existingIndex = prev.findIndex((s) => s.sellerId === sellerId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: clampedQty,
          };
          return updated;
        }

        // Add new selection
        return [
          ...prev,
          {
            sellerId: seller.sellerId,
            sellerDiscordId: seller.sellerDiscordId,
            quantity: clampedQty,
            price: seller.price,
            maxAvailable: seller.quantity,
          },
        ];
      });
    },
    [sellers]
  );

  // Quick select single seller for full quantity
  const selectSingleSeller = useCallback(
    (sellerId: string) => {
      const seller = sellers.find((s) => s.sellerId === sellerId);
      if (!seller) return;

      const qty = Math.min(requestedQuantity, seller.quantity);
      setSelections([
        {
          sellerId: seller.sellerId,
          sellerDiscordId: seller.sellerDiscordId,
          quantity: qty,
          price: seller.price,
          maxAvailable: seller.quantity,
        },
      ]);
    },
    [sellers, requestedQuantity]
  );

  // Handle confirm
  const handleConfirm = useCallback(() => {
    // Validate selections
    if (totalSelectedQuantity !== requestedQuantity) {
      return;
    }

    // Add each selection to cart
    for (const selection of selections) {
      addItem({
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        blueprintSlug: blueprint.slug,
        blueprintImage: blueprint.image,
        blueprintType: blueprint.type,
        sellerId: selection.sellerId,
        sellerDiscordId: selection.sellerDiscordId,
        quantity: selection.quantity,
        priceSnapshot: selection.price,
      });
    }

    onClose();
  }, [addItem, blueprint, selections, totalSelectedQuantity, requestedQuantity, onClose]);

  // Get current selection for a seller
  const getSellerSelection = useCallback(
    (sellerId: string) => selections.find((s) => s.sellerId === sellerId),
    [selections]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 rounded-xl max-w-2xl w-full border border-dark-600 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">Обрати продавця</h3>
            <p className="text-sm text-gray-400 mt-1">{blueprint.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quantity selector */}
        <div className="p-4 border-b border-dark-600 bg-dark-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Скільки потрібно:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRequestedQuantity((q) => Math.max(1, q - 1))}
                disabled={requestedQuantity <= 1}
                className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30"
              >
                -
              </button>
              <input
                type="number"
                value={requestedQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) {
                    setRequestedQuantity(Math.min(val, maxTotalAvailable || 999));
                  }
                }}
                min={1}
                max={maxTotalAvailable || 999}
                className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded text-center text-white focus:border-neon-cyan/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setRequestedQuantity((q) => Math.min(q + 1, maxTotalAvailable || 999))}
                disabled={requestedQuantity >= (maxTotalAvailable || 999)}
                className="w-8 h-8 flex items-center justify-center bg-dark-700 border border-dark-600 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          {/* Selection status */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              Обрано: <span className="text-white font-medium">{totalSelectedQuantity}</span> / {requestedQuantity}
            </span>
            {remainingQuantity > 0 && (
              <span className="text-sm text-yellow-400">
                Залишилось обрати: {remainingQuantity}
              </span>
            )}
            {remainingQuantity === 0 && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Готово
              </span>
            )}
          </div>

          {/* Warning if quantity cannot be fulfilled */}
          {requestedQuantity > maxTotalAvailable && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              Загальна наявність: {maxTotalAvailable}. Зменшіть кількість.
            </div>
          )}

          {/* Info about splitting */}
          {!canSingleSellerFulfill && requestedQuantity <= maxTotalAvailable && (
            <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-400">
              Жоден продавець не має {requestedQuantity} шт. Оберіть кілька продавців.
            </div>
          )}
        </div>

        {/* Sellers list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center py-8 text-gray-400">Завантаження...</div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400">{error}</div>
          )}

          {!isLoading && !error && sellers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Немає продавців з цим кресленням
            </div>
          )}

          {!isLoading && !error && sellers.length > 0 && (
            <div className="space-y-3">
              {sellers.map((seller) => {
                const selection = getSellerSelection(seller.sellerId);
                const isSelected = !!selection;
                const canFulfillAll = seller.quantity >= requestedQuantity;

                return (
                  <div
                    key={seller.sellerId}
                    className={`p-4 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-neon-cyan/10 border-neon-cyan/40"
                        : "bg-dark-700 border-dark-600 hover:border-dark-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white truncate">
                            {seller.sellerDiscordId}
                          </span>
                          {canFulfillAll && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                              Може виконати
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                          <span className="text-gray-400">
                            В наявності:{" "}
                            <span className="text-white">{seller.quantity}</span>
                          </span>
                          <span className="text-neon-purple">
                            {formatItemPrice(seller.price)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Quick select button for single seller fulfillment */}
                        {canFulfillAll && !isSelected && (
                          <button
                            onClick={() => selectSingleSeller(seller.sellerId)}
                            className="px-3 py-1.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded text-sm font-medium hover:bg-neon-cyan/30 transition-colors"
                          >
                            Обрати все
                          </button>
                        )}

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              updateSellerSelection(
                                seller.sellerId,
                                (selection?.quantity || 0) - 1
                              )
                            }
                            disabled={!isSelected}
                            className="w-7 h-7 flex items-center justify-center bg-dark-600 border border-dark-500 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={selection?.quantity || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                updateSellerSelection(seller.sellerId, val);
                              }
                            }}
                            min={0}
                            max={seller.quantity}
                            className="w-12 px-1 py-1 bg-dark-600 border border-dark-500 rounded text-center text-white text-sm focus:border-neon-cyan/50 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() =>
                              updateSellerSelection(
                                seller.sellerId,
                                (selection?.quantity || 0) + 1
                              )
                            }
                            disabled={(selection?.quantity || 0) >= seller.quantity}
                            className="w-7 h-7 flex items-center justify-center bg-dark-600 border border-dark-500 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-600 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-dark-700 text-gray-300 border border-dark-600 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleConfirm}
              disabled={remainingQuantity !== 0 || selections.length === 0}
              className="flex-1 px-4 py-2.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg text-sm font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Додати до кошика
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
