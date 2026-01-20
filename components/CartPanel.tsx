"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { formatItemPrice } from "@/lib/types";

interface CartPanelProps {
  className?: string;
}

export default function CartPanel({ className = "" }: CartPanelProps) {
  const {
    items,
    isCartOpen,
    isMultiSelectMode,
    removeItem,
    updateItemQuantity,
    clearCart,
    closeCart,
    exitMultiSelectMode,
    totalItems,
    totalQuantity,
  } = useCart();

  // Group items by blueprint for display
  const groupedByBlueprint = useMemo(() => {
    const groups = new Map<string, typeof items>();

    for (const item of items) {
      const existing = groups.get(item.blueprintId) || [];
      groups.set(item.blueprintId, [...existing, item]);
    }

    return Array.from(groups.entries());
  }, [items]);

  if (!isCartOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={closeCart}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-800 border-l border-dark-600 z-50 flex flex-col shadow-2xl ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600 shrink-0">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-neon-cyan"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-lg font-bold text-white">Кошик</h2>
            {totalItems > 0 && (
              <span className="px-2 py-0.5 bg-neon-cyan/20 text-neon-cyan text-sm rounded">
                {totalItems} {totalItems === 1 ? "позиція" : totalItems < 5 ? "позиції" : "позицій"}
              </span>
            )}
          </div>
          <button
            onClick={isMultiSelectMode ? exitMultiSelectMode : closeCart}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title={isMultiSelectMode ? "Завершити вибір" : "Закрити"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
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
              <p className="text-gray-500 mb-2">Кошик порожній</p>
              <p className="text-sm text-gray-600">
                Натисніть &quot;Обрати&quot; на кресленнях, щоб додати їх до кошика
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByBlueprint.map(([blueprintId, blueprintItems]) => (
                <div
                  key={blueprintId}
                  className="bg-dark-700 rounded-lg border border-dark-600 overflow-hidden"
                >
                  {/* Blueprint header */}
                  <div className="flex items-center gap-3 p-3 bg-dark-600/50 border-b border-dark-600">
                    {blueprintItems[0].blueprintImage && (
                      <img
                        src={blueprintItems[0].blueprintImage}
                        alt=""
                        className="w-10 h-10 rounded object-cover bg-dark-600"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {blueprintItems[0].blueprintName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {blueprintItems.length > 1
                          ? `${blueprintItems.length} продавці`
                          : "1 продавець"}
                      </p>
                    </div>
                  </div>

                  {/* Items per seller */}
                  <div className="divide-y divide-dark-600">
                    {blueprintItems.map((item) => (
                      <div key={item.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Продавець:</span>
                              <span className="text-sm text-white font-medium truncate">
                                {item.sellerDiscordId}
                              </span>
                            </div>
                            <div className="text-sm text-neon-purple mt-1">
                              {formatItemPrice(item.priceSnapshot)}
                            </div>
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 flex items-center justify-center bg-dark-600 border border-dark-500 rounded text-gray-400 hover:text-white hover:border-red-400/40 transition-colors text-sm"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-white text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 flex items-center justify-center bg-dark-600 border border-dark-500 rounded text-gray-400 hover:text-white hover:border-neon-cyan/40 transition-colors text-sm"
                            >
                              +
                            </button>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                            title="Видалити"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Negotiable warning */}
                        {item.priceSnapshot?.type === "Договірна" && (
                          <div className="mt-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                            Потрібно вказати пропозицію при оформленні
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-dark-600 shrink-0 space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Всього:</span>
              <span className="text-white font-medium">
                {totalQuantity} шт. ({totalItems} {totalItems === 1 ? "позиція" : "позицій"})
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={clearCart}
                className="px-4 py-2.5 bg-dark-700 text-gray-300 border border-dark-600 rounded-lg text-sm font-medium hover:bg-dark-600 hover:text-red-400 transition-colors"
              >
                Очистити
              </button>
              <Link
                href="/checkout"
                className="flex-1 px-4 py-2.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg text-sm font-medium hover:bg-neon-cyan/30 transition-colors text-center"
                onClick={() => {
                  if (isMultiSelectMode) {
                    exitMultiSelectMode();
                  }
                  closeCart();
                }}
              >
                Оформити замовлення
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
