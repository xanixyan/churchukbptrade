"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Blueprint, BlueprintSelectionWithSeller, SellerListing, formatItemPrice } from "@/lib/types";
import CheckoutModalWithSeller from "./CheckoutModalWithSeller";
import QuantitySelector from "./QuantitySelector";

interface BlueprintDetailProps {
  blueprint: Blueprint;
}

interface SellerWithBlueprintInfo extends SellerListing {
  blueprintId: string;
  blueprintName: string;
  blueprintSlug: string;
  blueprintImage: string;
}

export default function BlueprintDetail({ blueprint }: BlueprintDetailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Seller selection state
  const [sellers, setSellers] = useState<SellerListing[]>([]);
  const [recommendedSellerId, setRecommendedSellerId] = useState<string | null>(null);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<SellerListing | null>(null);

  // Fetch sellers for this blueprint
  useEffect(() => {
    const fetchSellers = async () => {
      setSellersLoading(true);
      try {
        const res = await fetch(`/api/blueprints/${blueprint.id}/sellers`);
        if (res.ok) {
          const data = await res.json();
          setSellers(data.sellers || []);

          // Track recommended seller from queue
          if (data.recommendedSeller) {
            setRecommendedSellerId(data.recommendedSeller.sellerId);
            // Auto-select recommended seller
            setSelectedSeller(data.recommendedSeller);
          } else if (data.sellers && data.sellers.length > 0) {
            // Fallback to first seller if no recommendation
            setSelectedSeller(data.sellers[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch sellers:", error);
      } finally {
        setSellersLoading(false);
      }
    };

    fetchSellers();
  }, [blueprint.id]);

  // Calculate max quantity from selected seller
  const maxQty = selectedSeller?.quantity || 0;
  const canBuy = sellers.length > 0 && selectedSeller !== null && maxQty > 0;

  // Reset quantity when seller changes
  useEffect(() => {
    if (selectedSeller) {
      setQuantity((prev) => Math.min(prev, selectedSeller.quantity) || 1);
    }
  }, [selectedSeller]);

  // Create selection for CheckoutModal with seller info
  const selection: BlueprintSelectionWithSeller[] = useMemo(() => {
    if (!selectedSeller) return [];
    return [{
      blueprint,
      quantity,
      sellerId: selectedSeller.sellerId,
      sellerDiscordId: selectedSeller.sellerDiscordId,
      priceSnapshot: selectedSeller.price,
    }];
  }, [blueprint, quantity, selectedSeller]);

  // Handle successful order
  const handleOrderSuccess = () => {
    setIsModalOpen(false);
    setQuantity(1);
  };

  // Handle seller selection
  const handleSelectSeller = (seller: SellerListing) => {
    setSelectedSeller(seller);
    setQuantity(1);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
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

        <div className="bg-dark-800 rounded-xl overflow-hidden border border-dark-600">
          <div className="md:flex">
            {/* Image */}
            <div
              className="md:w-1/2 aspect-square bg-dark-700 bg-cover bg-center relative"
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

              {/* Owned badge with quantity */}
              <div className={"absolute top-4 right-4 px-3 py-1.5 text-sm font-bold rounded border " + (
                (blueprint.ownedQty || 0) > 0
                  ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                  : "bg-gray-800/80 text-gray-500 border-gray-600"
              )}>
                {(blueprint.ownedQty || 0) > 0 ? "×" + blueprint.ownedQty : "Немає"}
              </div>
            </div>

            {/* Info */}
            <div className="md:w-1/2 p-6">
              <p className="text-sm text-gray-500 font-mono mb-2">{blueprint.id}</p>
              <h1 className="text-2xl font-bold text-white mb-4">{blueprint.name}</h1>

              {/* Status */}
              <div className="flex items-center gap-2 mb-6">
                <span
                  className={"px-3 py-1 text-sm rounded-full " + (
                    (blueprint.ownedQty || 0) > 0
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                      : "bg-gray-700 text-gray-400 border border-gray-600"
                  )}
                >
                  {(blueprint.ownedQty || 0) > 0 ? "В наявності ×" + blueprint.ownedQty : "Немає в наявності"}
                </span>
              </div>

              {/* Notes */}
              {blueprint.notes && (
                <div className="mb-6 p-4 bg-dark-700 rounded-lg border border-dark-600">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Примітки</h3>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{blueprint.notes}</p>
                </div>
              )}

              {/* Seller selection */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Оберіть продавця:</h3>

                {sellersLoading ? (
                  <div className="p-4 bg-dark-700 rounded-lg border border-dark-600 text-center text-gray-400">
                    Завантаження продавців...
                  </div>
                ) : sellers.length === 0 ? (
                  <div className="p-4 bg-dark-700 rounded-lg border border-dark-600 text-center text-gray-500">
                    Наразі немає продавців з цим кресленням
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sellers.map((seller) => {
                      const isSelected = selectedSeller?.sellerId === seller.sellerId;
                      return (
                        <button
                          key={seller.sellerId}
                          onClick={() => handleSelectSeller(seller)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            isSelected
                              ? "bg-neon-cyan/10 border-neon-cyan/50"
                              : "bg-dark-700 border-dark-600 hover:border-dark-500"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Selection indicator */}
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-neon-cyan bg-neon-cyan"
                                  : "border-gray-500"
                              }`}>
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-dark-900" />
                                )}
                              </div>
                              {/* Seller info */}
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{seller.sellerDiscordId}</span>
                                <span className="text-gray-500 text-sm">×{seller.quantity}</span>
                              </div>
                            </div>
                            {/* Price */}
                            <span className={`font-bold ${seller.price ? "text-neon-purple" : "text-gray-500"}`}>
                              {formatItemPrice(seller.price)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quantity selector (only when seller is selected) */}
              {canBuy && selectedSeller && (
                <div className="mb-4 p-4 bg-dark-700 rounded-lg border border-dark-600">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Кількість:</span>
                    <QuantitySelector
                      quantity={quantity}
                      onChange={setQuantity}
                      size="md"
                      max={maxQty}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      Доступно у продавця: {maxQty}
                    </p>
                    {selectedSeller.price && (
                      <p className="text-sm text-neon-purple font-medium">
                        Ціна: {formatItemPrice(selectedSeller.price)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Buy button */}
              {canBuy ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full neon-btn py-3 px-6 rounded-lg font-bold text-black"
                >
                  Купити {quantity > 1 ? "(×" + quantity + ")" : ""}
                  {selectedSeller?.price ? ` — ${formatItemPrice(selectedSeller.price)}` : ""}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-6 rounded-lg font-bold bg-gray-700 text-gray-500 cursor-not-allowed"
                >
                  {sellersLoading ? "Завантаження..." : "Немає в наявності"}
                </button>
              )}

              <p className="mt-4 text-xs text-gray-500 text-center">
                Після оформлення продавець отримає повідомлення та напише вам в Discord
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pass selection with seller info */}
      <CheckoutModalWithSeller
        selections={selection}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleOrderSuccess}
      />
    </>
  );
}
