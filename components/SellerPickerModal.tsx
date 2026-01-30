"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Blueprint, SellerListing, ItemPrice } from "@/lib/types";
import { useCart } from "@/contexts/CartContext";
import SellerList, { SellerWithEffective } from "./SellerList";

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
  const { addItem, getQtyInCart } = useCart();

  const [sellers, setSellers] = useState<SellerListing[]>([]);
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

  // Calculate effective available for each seller (accounting for cart)
  const getEffectiveAvailable = useCallback(
    (sellerId: string, sellerStock: number): number => {
      const qtyInCart = getQtyInCart(blueprint.id, sellerId);
      return Math.max(0, sellerStock - qtyInCart);
    },
    [getQtyInCart, blueprint.id]
  );

  // Filter sellers to only those with effective available > 0
  const availableSellers = useMemo((): SellerWithEffective[] => {
    return sellers
      .map((seller) => ({
        ...seller,
        effectiveAvailable: getEffectiveAvailable(seller.sellerId, seller.quantity),
        qtyInCart: getQtyInCart(blueprint.id, seller.sellerId),
      }))
      .filter((seller) => seller.effectiveAvailable > 0);
  }, [sellers, getEffectiveAvailable, getQtyInCart, blueprint.id]);

  // Sellers that are fully in cart (for showing disabled state)
  const sellersInCart = useMemo((): SellerWithEffective[] => {
    return sellers
      .map((seller) => ({
        ...seller,
        effectiveAvailable: getEffectiveAvailable(seller.sellerId, seller.quantity),
        qtyInCart: getQtyInCart(blueprint.id, seller.sellerId),
      }))
      .filter((seller) => seller.effectiveAvailable <= 0 && seller.qtyInCart > 0);
  }, [sellers, getEffectiveAvailable, getQtyInCart, blueprint.id]);

  // Calculate total selected quantity
  const totalSelectedQuantity = useMemo(
    () => selections.reduce((sum, s) => sum + s.quantity, 0),
    [selections]
  );

  // Calculate remaining quantity to select
  const remainingQuantity = requestedQuantity - totalSelectedQuantity;

  // Get maximum total available across all sellers (using effective available)
  const maxTotalAvailable = useMemo(
    () => availableSellers.reduce((sum, s) => sum + s.effectiveAvailable, 0),
    [availableSellers]
  );

  // Get current selection quantity for a seller
  const getSellerQuantity = useCallback(
    (sellerId: string): number => {
      const selection = selections.find((s) => s.sellerId === sellerId);
      return selection?.quantity || 0;
    },
    [selections]
  );

  // Update seller selection (using effective available)
  const updateSellerSelection = useCallback(
    (sellerId: string, quantity: number) => {
      const seller = availableSellers.find((s) => s.sellerId === sellerId);
      if (!seller) return;

      setSelections((prev) => {
        // Remove if quantity is 0
        if (quantity <= 0) {
          return prev.filter((s) => s.sellerId !== sellerId);
        }

        // Clamp quantity to effective available (not raw stock)
        const clampedQty = Math.min(quantity, seller.effectiveAvailable);

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
            maxAvailable: seller.effectiveAvailable,
          },
        ];
      });
    },
    [availableSellers]
  );

  // Quick select single seller for full quantity (using effective available)
  const selectSingleSeller = useCallback(
    (sellerId: string) => {
      const seller = availableSellers.find((s) => s.sellerId === sellerId);
      if (!seller) return;

      const qty = Math.min(requestedQuantity, seller.effectiveAvailable);
      setSelections([
        {
          sellerId: seller.sellerId,
          sellerDiscordId: seller.sellerDiscordId,
          quantity: qty,
          price: seller.price,
          maxAvailable: seller.effectiveAvailable,
        },
      ]);
    },
    [availableSellers, requestedQuantity]
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

  // ESC key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

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
        <div className="p-4 border-b border-dark-600 bg-dark-700/50 shrink-0">
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
          {requestedQuantity > maxTotalAvailable && maxTotalAvailable > 0 && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              Загальна наявність: {maxTotalAvailable}. Зменшіть кількість.
            </div>
          )}
        </div>

        {/* Sellers list */}
        <div className="flex-1 overflow-hidden p-4">
          <SellerList
            sellers={availableSellers}
            sellersInCart={sellersInCart}
            isLoading={isLoading}
            error={error}
            mode="multi"
            getSellerQuantity={getSellerQuantity}
            onUpdateQuantity={updateSellerSelection}
            onSelectAll={selectSingleSeller}
            requestedQuantity={requestedQuantity}
            maxHeight="350px"
            showAllInCartMessage={true}
          />
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
