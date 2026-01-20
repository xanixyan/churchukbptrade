"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Blueprint, BlueprintSelection, getMaxSelectableQty } from "@/lib/types";
import CheckoutModal from "./CheckoutModal";
import QuantitySelector from "./QuantitySelector";

interface BlueprintDetailProps {
  blueprint: Blueprint;
}

export default function BlueprintDetail({ blueprint }: BlueprintDetailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const maxQty = getMaxSelectableQty(blueprint);
  const canBuy = maxQty > 0;

  // Create selection for CheckoutModal
  const selection: BlueprintSelection[] = useMemo(
    () => [{ blueprint, quantity }],
    [blueprint, quantity]
  );

  // Handle successful order
  const handleOrderSuccess = () => {
    setIsModalOpen(false);
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

              {/* Quantity selector (only for owned blueprints) */}
              {canBuy && (
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
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    Доступно: {maxQty}
                  </p>
                </div>
              )}

              {/* Buy button */}
              {canBuy ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full neon-btn py-3 px-6 rounded-lg font-bold text-black"
                >
                  Купити {quantity > 1 ? "(×" + quantity + ")" : ""}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-6 rounded-lg font-bold bg-gray-700 text-gray-500 cursor-not-allowed"
                >
                  Немає в наявності
                </button>
              )}

              <p className="mt-4 text-xs text-gray-500 text-center">
                Після оформлення я отримаю повідомлення та напишу вам в Discord
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Updated: pass selection with quantity */}
      <CheckoutModal
        selections={selection}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleOrderSuccess}
      />
    </>
  );
}
