"use client";

import Link from "next/link";
import { Blueprint, getMaxSelectableQty } from "@/lib/types";
import QuantitySelector from "./QuantitySelector";

interface BlueprintCardProps {
  blueprint: Blueprint;
  // Select mode props
  selectMode?: boolean;
  isSelected?: boolean;
  quantity?: number;
  onToggleSelect?: (blueprint: Blueprint) => void;
  onQuantityChange?: (blueprint: Blueprint, quantity: number) => void;
}

export default function BlueprintCard({
  blueprint,
  selectMode = false,
  isSelected = false,
  quantity = 1,
  onToggleSelect,
  onQuantityChange,
}: BlueprintCardProps) {
  const maxQty = getMaxSelectableQty(blueprint);
  const canSelect = maxQty > 0;

  // Handle click in select mode
  const handleClick = (e: React.MouseEvent) => {
    if (selectMode && onToggleSelect && canSelect) {
      e.preventDefault();
      onToggleSelect(blueprint);
    }
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (onQuantityChange) {
      // Clamp to max available
      const clampedQty = Math.min(Math.max(1, newQuantity), maxQty);
      onQuantityChange(blueprint, clampedQty);
    }
  };

  const cardContent = (
    <div
      className={`gamer-card bg-dark-800 rounded-lg overflow-hidden ${
        isSelected ? "ring-2 ring-neon-cyan shadow-neon" : ""
      } ${selectMode && !canSelect ? "opacity-50" : ""}`}
    >
      {/* Image */}
      <div
        className="aspect-square bg-dark-700 bg-cover bg-center relative"
        style={{
          backgroundImage: blueprint.image ? `url(${blueprint.image})` : undefined,
        }}
      >
        {!blueprint.image && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Select mode checkbox */}
        {selectMode && canSelect && (
          <div className="absolute top-2 left-2">
            <div
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-neon-cyan border-neon-cyan"
                  : "bg-dark-800/80 border-gray-500 hover:border-neon-cyan/50"
              }`}
            >
              {isSelected && (
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Quantity badge when selected */}
        {selectMode && isSelected && quantity > 1 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-neon-purple/80 text-white text-xs font-bold rounded">
            ×{quantity}
          </div>
        )}

        {/* Owned badge with quantity (not in select mode) */}
        {!selectMode && (
          <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-bold rounded border ${
            (blueprint.ownedQty || 0) > 0
              ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
              : "bg-gray-800/80 text-gray-500 border-gray-600"
          }`}>
            {(blueprint.ownedQty || 0) > 0 ? `×${blueprint.ownedQty}` : "Немає"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-gray-500 font-mono mb-1">{blueprint.id}</p>
        <h3 className="text-sm font-medium text-white truncate">{blueprint.name}</h3>

        {/* Quantity selector when selected in select mode */}
        {selectMode && isSelected && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">К-сть:</span>
              <QuantitySelector
                quantity={quantity}
                onChange={handleQuantityChange}
                size="sm"
                max={maxQty}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              Доступно: {maxQty}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // In select mode, use div with onClick; otherwise use Link
  if (selectMode) {
    return (
      <div
        className={`block ${canSelect ? "cursor-pointer" : "cursor-not-allowed"}`}
        onClick={handleClick}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/bp/${blueprint.slug}/`} className="block">
      {cardContent}
    </Link>
  );
}
