"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Blueprint, SellerListing, formatItemPrice } from "@/lib/types";
import { useCart } from "@/contexts/CartContext";
import SellerList, { SellerWithEffective } from "./SellerList";

interface BlueprintDetailProps {
  blueprint: Blueprint;
}

export default function BlueprintDetail({ blueprint }: BlueprintDetailProps) {
  const { addItem, getQtyInCart, openCart } = useCart();

  // Seller data state
  const [sellers, setSellers] = useState<SellerListing[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [sellersError, setSellersError] = useState<string | null>(null);

  // Selected seller for display purposes
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  // Success toast state
  const [showAddedToast, setShowAddedToast] = useState(false);

  // Fetch sellers for this blueprint
  useEffect(() => {
    const fetchSellers = async () => {
      setSellersLoading(true);
      setSellersError(null);

      try {
        const res = await fetch(`/api/blueprints/${blueprint.id}/sellers`);
        if (!res.ok) throw new Error("Failed to fetch sellers");

        const data = await res.json();
        setSellers(data.sellers || []);

        // Auto-select first available seller
        if (data.sellers && data.sellers.length > 0) {
          setSelectedSellerId(data.sellers[0].sellerId);
        }
      } catch (error) {
        console.error("Failed to fetch sellers:", error);
        setSellersError("Не вдалося завантажити продавців");
      } finally {
        setSellersLoading(false);
      }
    };

    fetchSellers();
  }, [blueprint.id]);

  // Calculate effective available for each seller (accounting for cart)
  const getEffectiveAvailable = useCallback(
    (sellerId: string, sellerStock: number): number => {
      const qtyInCart = getQtyInCart(blueprint.id, sellerId);
      return Math.max(0, sellerStock - qtyInCart);
    },
    [getQtyInCart, blueprint.id]
  );

  // Transform sellers to include effective available
  const availableSellers = useMemo((): SellerWithEffective[] => {
    return sellers
      .map((seller) => ({
        ...seller,
        effectiveAvailable: getEffectiveAvailable(seller.sellerId, seller.quantity),
        qtyInCart: getQtyInCart(blueprint.id, seller.sellerId),
      }))
      .filter((seller) => seller.effectiveAvailable > 0);
  }, [sellers, getEffectiveAvailable, getQtyInCart, blueprint.id]);

  // Sellers fully in cart
  const sellersInCart = useMemo((): SellerWithEffective[] => {
    return sellers
      .map((seller) => ({
        ...seller,
        effectiveAvailable: getEffectiveAvailable(seller.sellerId, seller.quantity),
        qtyInCart: getQtyInCart(blueprint.id, seller.sellerId),
      }))
      .filter((seller) => seller.effectiveAvailable <= 0 && seller.qtyInCart > 0);
  }, [sellers, getEffectiveAvailable, getQtyInCart, blueprint.id]);

  // Handle seller selection
  const handleSelectSeller = useCallback((seller: SellerWithEffective) => {
    setSelectedSellerId(seller.sellerId);
  }, []);

  // Handle add to cart
  const handleAddToCart = useCallback(
    (seller: SellerWithEffective, quantity: number) => {
      addItem({
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        blueprintSlug: blueprint.slug,
        blueprintImage: blueprint.image,
        blueprintType: blueprint.type,
        sellerId: seller.sellerId,
        sellerDiscordId: seller.sellerDiscordId,
        quantity,
        priceSnapshot: seller.price,
        sellerPublicNote: seller.publicNote || null,
      });

      // Show success toast
      setShowAddedToast(true);
      setTimeout(() => setShowAddedToast(false), 2000);

      // Open cart panel
      openCart();
    },
    [addItem, blueprint, openCart]
  );

  // Get selected seller info
  const selectedSeller = useMemo(() => {
    if (!selectedSellerId) return null;
    return [...availableSellers, ...sellersInCart].find(
      (s) => s.sellerId === selectedSellerId
    );
  }, [selectedSellerId, availableSellers, sellersInCart]);

  // Total availability
  const totalAvailable = useMemo(
    () => availableSellers.reduce((sum, s) => sum + s.effectiveAvailable, 0),
    [availableSellers]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-cyan transition-colors mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Назад до каталогу
      </Link>

      {/* Success toast */}
      {showAddedToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Додано до кошика!</span>
        </div>
      )}

      <div className="bg-dark-800 rounded-xl overflow-hidden border border-dark-600">
        {/* Top section: Image + Basic Info */}
        <div className="md:flex">
          {/* Image */}
          <div
            className="md:w-2/5 aspect-square bg-dark-700 bg-cover bg-center relative"
            style={{
              backgroundImage: blueprint.image ? `url(${blueprint.image})` : undefined,
            }}
          >
            {!blueprint.image && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}

            {/* Availability badge */}
            <div
              className={`absolute top-4 right-4 px-3 py-1.5 text-sm font-bold rounded border ${
                totalAvailable > 0
                  ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                  : "bg-gray-800/80 text-gray-500 border-gray-600"
              }`}
            >
              {totalAvailable > 0 ? `${totalAvailable} шт.` : "Немає"}
            </div>
          </div>

          {/* Basic Info */}
          <div className="md:w-3/5 p-6">
            <p className="text-sm text-gray-500 font-mono mb-2">{blueprint.id}</p>
            <h1 className="text-2xl font-bold text-white mb-3">{blueprint.name}</h1>

            {/* Type badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 text-sm rounded-full bg-dark-700 text-gray-300 border border-dark-600">
                {blueprint.type}
              </span>
              {sellers.length > 0 && (
                <span className="text-sm text-gray-500">
                  {sellers.length} {sellers.length === 1 ? "продавець" : sellers.length < 5 ? "продавці" : "продавців"}
                </span>
              )}
            </div>

            {/* Notes */}
            {blueprint.notes && (
              <div className="mb-4 p-4 bg-dark-700 rounded-lg border border-dark-600">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Примітки</h3>
                <p className="text-sm text-gray-400 whitespace-pre-wrap break-words">{blueprint.notes}</p>
              </div>
            )}

            {/* Selected seller summary */}
            {selectedSeller && selectedSeller.effectiveAvailable > 0 && (
              <div className="p-4 bg-dark-700/50 rounded-lg border border-neon-cyan/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Обраний продавець</p>
                    <p className="text-white font-medium">{selectedSeller.sellerDiscordId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-neon-purple font-bold">{formatItemPrice(selectedSeller.price)}</p>
                    <p className="text-sm text-gray-500">Доступно: {selectedSeller.effectiveAvailable}</p>
                  </div>
                </div>
              </div>
            )}

            {/* No availability message */}
            {!sellersLoading && totalAvailable === 0 && (
              <div className="p-4 bg-dark-700 rounded-lg border border-dark-600 text-center">
                <p className="text-gray-500">
                  {sellers.length === 0
                    ? "Наразі немає продавців з цим кресленням"
                    : "Усі креслення вже в кошику"}
                </p>
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              Оберіть продавця та додайте до кошика. Після оформлення продавець отримає сповіщення.
            </p>
          </div>
        </div>

        {/* Seller List Section */}
        <div className="border-t border-dark-600 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Продавці
          </h2>

          <SellerList
            sellers={availableSellers}
            sellersInCart={sellersInCart}
            isLoading={sellersLoading}
            error={sellersError}
            mode="single"
            selectedSellerId={selectedSellerId}
            onSelectSeller={handleSelectSeller}
            onAddToCart={handleAddToCart}
            maxHeight="400px"
            showAllInCartMessage={true}
          />
        </div>
      </div>
    </div>
  );
}
