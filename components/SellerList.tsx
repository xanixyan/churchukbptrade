"use client";

import { useState, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { SellerListing, formatItemPrice } from "@/lib/types";

// ============================================
// TYPES
// ============================================

export type SortOption = "stock_desc" | "discord_asc";

export interface SellerWithEffective extends SellerListing {
  effectiveAvailable: number;
  qtyInCart: number;
}

export interface SellerListProps {
  sellers: SellerWithEffective[];
  sellersInCart?: SellerWithEffective[];
  isLoading: boolean;
  error: string | null;
  // Mode: "single" for product page (select one), "multi" for split across sellers
  mode: "single" | "multi";
  // For single mode
  selectedSellerId?: string | null;
  onSelectSeller?: (seller: SellerWithEffective) => void;
  // For multi mode
  getSellerQuantity?: (sellerId: string) => number;
  onUpdateQuantity?: (sellerId: string, quantity: number) => void;
  onSelectAll?: (sellerId: string) => void;
  requestedQuantity?: number;
  // For adding to cart directly (single mode with cart)
  onAddToCart?: (seller: SellerWithEffective, quantity: number) => void;
  // Max height for scrollable area
  maxHeight?: string;
  // Show "all sellers in cart" state
  showAllInCartMessage?: boolean;
}

// ============================================
// SELLER LIST CONTROLS
// ============================================

interface SellerListControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onlyInStock: boolean;
  onOnlyInStockChange: (value: boolean) => void;
  totalCount: number;
  filteredCount: number;
}

const SellerListControls = memo(function SellerListControls({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  onlyInStock,
  onOnlyInStockChange,
  totalCount,
  filteredCount,
}: SellerListControlsProps) {
  return (
    <div className="space-y-3 mb-4">
      {/* Search and Sort row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Пошук за Discord..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-gray-500 focus:border-neon-cyan/50 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-neon-cyan/50 focus:outline-none cursor-pointer"
        >
          <option value="stock_desc">За наявністю</option>
          <option value="discord_asc">За ніком (A-Z)</option>
        </select>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between">
        {/* Only in stock toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => onOnlyInStockChange(e.target.checked)}
            className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-neon-cyan focus:ring-neon-cyan/50 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-sm text-gray-400">Тільки в наявності</span>
        </label>

        {/* Count display */}
        <span className="text-xs text-gray-500">
          {filteredCount === totalCount
            ? `${totalCount} продавців`
            : `${filteredCount} з ${totalCount}`}
        </span>
      </div>
    </div>
  );
});

// ============================================
// SHARED INLINE STEPPER
// ============================================
// Extracted so both Single and Multi rows use identical markup.
// All interactive elements are h-8 for perfect vertical alignment.

interface InlineStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const InlineStepper = memo(function InlineStepper({
  value,
  min,
  max,
  onChange,
}: InlineStepperProps) {
  return (
    <div className="inline-flex items-center h-8">
      <button
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center bg-dark-600 border border-dark-500 rounded-l text-gray-400 hover:text-white disabled:opacity-30 text-sm leading-none select-none"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.max(min, Math.min(n, max)));
        }}
        min={min}
        max={max}
        className="w-10 h-8 text-center text-sm bg-dark-700 border-y border-dark-500 text-white focus:outline-none leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="w-8 h-8 flex items-center justify-center bg-dark-600 border border-dark-500 rounded-r text-gray-400 hover:text-white disabled:opacity-30 text-sm leading-none select-none"
      >
        +
      </button>
    </div>
  );
});

// ============================================
// SELLER ROW (Single mode - radio selection)
// ============================================
//
// Layout: pure flex, no table header.
// The old code had a fake "table header" row (К-сть / Ціна columns) rendered as
// a flex div, while data rows were also flex but with different child widths.
// Because the header and rows had no shared grid-template, the columns never
// aligned — stock/price text in data rows drifted relative to the header labels.
//
// Fix (Option B): remove the table header entirely. Each row now shows stock &
// price as compact inline-labeled pills ("2 шт." / "Договірна") so there is
// nothing to mis-align against. The row is a single flex container with
// items-center and min-h-[48px], split into left (identity) and right (actions).
// Every interactive element in the right block is exactly h-8 so nothing drifts
// vertically.

interface SellerRowSingleProps {
  seller: SellerWithEffective;
  isSelected: boolean;
  onSelect: () => void;
  onAddToCart?: (quantity: number) => void;
  showAddButton?: boolean;
}

const SellerRowSingle = memo(function SellerRowSingle({
  seller,
  isSelected,
  onSelect,
  onAddToCart,
  showAddButton = false,
}: SellerRowSingleProps) {
  const [quantity, setQuantity] = useState(1);
  const maxQty = seller.effectiveAvailable;
  const isDisabled = maxQty <= 0;

  const handleQuantityChange = (newQty: number) => {
    setQuantity(Math.max(1, Math.min(newQty, maxQty)));
  };

  const handleAdd = () => {
    if (onAddToCart && !isDisabled) {
      onAddToCart(quantity);
      setQuantity(1);
    }
  };

  return (
    <div
      onClick={() => !isDisabled && onSelect()}
      className={`flex items-center min-h-[48px] gap-3 px-3 py-2 border-b border-dark-600 last:border-b-0 transition-colors ${
        isDisabled
          ? "opacity-50 cursor-not-allowed bg-dark-800/50"
          : isSelected
          ? "bg-neon-cyan/10 cursor-pointer"
          : "hover:bg-dark-700/50 cursor-pointer"
      }`}
    >
      {/* ── Left: radio + seller identity ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Radio dot */}
        <div
          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
            isSelected ? "border-neon-cyan bg-neon-cyan" : "border-gray-500"
          }`}
        >
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-dark-900" />}
        </div>

        {/* Name + optional note */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/sellers/${seller.sellerId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-white hover:text-neon-cyan hover:underline transition-colors leading-tight"
            title="Перейти до профілю продавця"
            aria-label={`Профіль ${seller.sellerDiscordId}`}
          >
            {seller.sellerDiscordId}
          </Link>
          {seller.publicNote && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{seller.publicNote}</p>
          )}
        </div>
      </div>

      {/* ── Right: stock pill, price pill, stepper, add button ── */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {/* Stock pill */}
        <span className="inline-flex items-center h-6 px-1.5 text-xs tabular-nums rounded bg-dark-600/80 text-gray-300 whitespace-nowrap leading-none">
          {seller.qtyInCart > 0 ? (
            <>
              {seller.effectiveAvailable}
              <span className="text-yellow-400 ml-0.5">+{seller.qtyInCart}</span>
            </>
          ) : (
            <>{seller.quantity} шт.</>
          )}
        </span>

        {/* Price pill */}
        <span
          className="inline-flex items-center h-6 px-1.5 text-xs rounded bg-neon-purple/10 text-neon-purple whitespace-nowrap leading-none max-w-[8rem] truncate"
          title={formatItemPrice(seller.price)}
        >
          {formatItemPrice(seller.price)}
        </span>

        {/* Stepper + Add — only when selected & enabled */}
        {showAddButton && isSelected && !isDisabled && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <InlineStepper
              value={quantity}
              min={1}
              max={maxQty}
              onChange={handleQuantityChange}
            />
            <button
              onClick={handleAdd}
              className="h-8 px-3 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded text-xs font-medium hover:bg-neon-cyan/30 transition-colors leading-none whitespace-nowrap"
            >
              Додати
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// SELLER ROW (Multi mode - quantity allocation)
// ============================================

interface SellerRowMultiProps {
  seller: SellerWithEffective;
  selectedQuantity: number;
  onUpdateQuantity: (quantity: number) => void;
  onSelectAll?: () => void;
  canFulfillAll: boolean;
}

const SellerRowMulti = memo(function SellerRowMulti({
  seller,
  selectedQuantity,
  onUpdateQuantity,
  onSelectAll,
  canFulfillAll,
}: SellerRowMultiProps) {
  const isSelected = selectedQuantity > 0;
  const maxQty = seller.effectiveAvailable;
  const isDisabled = maxQty <= 0;

  return (
    <div
      className={`flex items-center min-h-[48px] gap-3 px-3 py-2 border-b border-dark-600 last:border-b-0 transition-colors ${
        isDisabled
          ? "opacity-50 bg-dark-800/50"
          : isSelected
          ? "bg-neon-cyan/10"
          : "hover:bg-dark-700/50"
      }`}
    >
      {/* ── Left: seller identity + badges ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="min-w-0 flex-1">
          <Link
            href={`/sellers/${seller.sellerId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-white hover:text-neon-cyan hover:underline transition-colors leading-tight"
            title="Перейти до профілю продавця"
            aria-label={`Профіль ${seller.sellerDiscordId}`}
          >
            {seller.sellerDiscordId}
          </Link>
          {seller.publicNote && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{seller.publicNote}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {canFulfillAll && !isDisabled && (
            <span className="inline-flex items-center h-5 px-1.5 bg-green-500/20 text-green-400 text-xs rounded leading-none">
              OK
            </span>
          )}
          {seller.qtyInCart > 0 && (
            <span className="inline-flex items-center h-5 px-1.5 bg-yellow-500/20 text-yellow-400 text-xs rounded leading-none">
              +{seller.qtyInCart}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: stock pill, price pill, controls ── */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {/* Stock pill */}
        <span className="inline-flex items-center h-6 px-1.5 text-xs tabular-nums rounded bg-dark-600/80 text-gray-300 whitespace-nowrap leading-none">
          {seller.effectiveAvailable} шт.
        </span>

        {/* Price pill */}
        <span
          className="inline-flex items-center h-6 px-1.5 text-xs rounded bg-neon-purple/10 text-neon-purple whitespace-nowrap leading-none max-w-[7rem] truncate"
          title={formatItemPrice(seller.price)}
        >
          {formatItemPrice(seller.price)}
        </span>

        {/* Controls */}
        {!isDisabled && (
          <div className="flex items-center gap-1.5">
            {canFulfillAll && !isSelected && onSelectAll && (
              <button
                onClick={onSelectAll}
                className="h-8 px-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded text-xs font-medium hover:bg-neon-cyan/30 transition-colors leading-none whitespace-nowrap"
              >
                Все
              </button>
            )}
            <InlineStepper
              value={selectedQuantity}
              min={0}
              max={maxQty}
              onChange={onUpdateQuantity}
            />
          </div>
        )}

        {isDisabled && (
          <span className="text-xs text-gray-500 leading-none">Недоступно</span>
        )}
      </div>
    </div>
  );
});

// ============================================
// MAIN SELLER LIST COMPONENT
// ============================================

export default function SellerList({
  sellers,
  sellersInCart = [],
  isLoading,
  error,
  mode,
  selectedSellerId,
  onSelectSeller,
  getSellerQuantity,
  onUpdateQuantity,
  onSelectAll,
  requestedQuantity = 1,
  onAddToCart,
  maxHeight = "420px",
  showAllInCartMessage = true,
}: SellerListProps) {
  // Local state for controls
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("stock_desc");
  const [onlyInStock, setOnlyInStock] = useState(true);

  // Combined list (available + in cart)
  const allSellers = useMemo(() => {
    return [...sellers, ...sellersInCart];
  }, [sellers, sellersInCart]);

  // Filtered and sorted sellers
  const filteredSellers = useMemo(() => {
    let result = [...allSellers];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        s.sellerDiscordId.toLowerCase().includes(query)
      );
    }

    // Filter by stock (effectiveAvailable > 0)
    if (onlyInStock) {
      result = result.filter((s) => s.effectiveAvailable > 0);
    }

    // Sort
    switch (sortOption) {
      case "stock_desc":
        result.sort((a, b) => b.effectiveAvailable - a.effectiveAvailable);
        break;
      case "discord_asc":
        result.sort((a, b) => a.sellerDiscordId.localeCompare(b.sellerDiscordId));
        break;
    }

    return result;
  }, [allSellers, searchQuery, sortOption, onlyInStock]);

  // Handler for single mode selection
  const handleSelectSingle = useCallback(
    (seller: SellerWithEffective) => {
      if (onSelectSeller && seller.effectiveAvailable > 0) {
        onSelectSeller(seller);
      }
    },
    [onSelectSeller]
  );

  // Handler for single mode add to cart
  const handleAddToCart = useCallback(
    (seller: SellerWithEffective, quantity: number) => {
      if (onAddToCart && seller.effectiveAvailable > 0) {
        onAddToCart(seller, quantity);
      }
    },
    [onAddToCart]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-dark-700 rounded-lg border border-dark-600 p-8">
        <div className="flex items-center justify-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Завантаження продавців...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-dark-700 rounded-lg border border-red-500/30 p-8 text-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  // No sellers at all
  if (allSellers.length === 0) {
    return (
      <div className="bg-dark-700 rounded-lg border border-dark-600 p-8 text-center">
        <div className="text-gray-500">Наразі немає продавців з цим кресленням</div>
      </div>
    );
  }

  // All sellers are in cart
  if (showAllInCartMessage && sellers.length === 0 && sellersInCart.length > 0 && onlyInStock) {
    return (
      <div className="space-y-4">
        <SellerListControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOption={sortOption}
          onSortChange={setSortOption}
          onlyInStock={onlyInStock}
          onOnlyInStockChange={setOnlyInStock}
          totalCount={allSellers.length}
          filteredCount={filteredSellers.length}
        />
        <div className="bg-dark-700 rounded-lg border border-dark-600 p-8 text-center">
          <p className="text-gray-400 mb-2">Усі продавці вже в кошику</p>
          <p className="text-sm text-gray-500">Змініть кількість у кошику або зніміть фільтр</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Controls */}
      <SellerListControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOption={sortOption}
        onSortChange={setSortOption}
        onlyInStock={onlyInStock}
        onOnlyInStockChange={setOnlyInStock}
        totalCount={allSellers.length}
        filteredCount={filteredSellers.length}
      />

      {/*
       * Seller rows container — NO table header row.
       *
       * The previous implementation had a fake "header" div with "К-сть" /
       * "Ціна" labels rendered as flex children, while data rows were also
       * flex but with different child widths (content-dependent text vs
       * fixed placeholder spans). Because there was no shared column
       * template, the header labels and row data never aligned — stock and
       * price text drifted horizontally and the stepper/button sat at a
       * different vertical position than the header suggested.
       *
       * Fix: removed the header entirely (Option B). Stock and price are
       * now self-labeled pills inside each row ("2 шт.", "Договірна") so
       * there is nothing external to mis-align against. Every row is a
       * single flex container with items-center + min-h-[48px], and every
       * interactive element in the right block is exactly h-8.
       */}
      <div className="bg-dark-700 rounded-lg border border-dark-600 overflow-hidden">
        {/* Scrollable rows */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight }}
        >
          {filteredSellers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Нічого не знайдено
            </div>
          ) : mode === "single" ? (
            // Single selection mode
            filteredSellers.map((seller) => (
              <SellerRowSingle
                key={seller.sellerId}
                seller={seller}
                isSelected={selectedSellerId === seller.sellerId}
                onSelect={() => handleSelectSingle(seller)}
                onAddToCart={onAddToCart ? (qty) => handleAddToCart(seller, qty) : undefined}
                showAddButton={!!onAddToCart}
              />
            ))
          ) : (
            // Multi selection mode
            filteredSellers.map((seller) => {
              const selectedQty = getSellerQuantity?.(seller.sellerId) || 0;
              const canFulfillAll = seller.effectiveAvailable >= requestedQuantity;

              return (
                <SellerRowMulti
                  key={seller.sellerId}
                  seller={seller}
                  selectedQuantity={selectedQty}
                  onUpdateQuantity={(qty) => onUpdateQuantity?.(seller.sellerId, qty)}
                  onSelectAll={onSelectAll ? () => onSelectAll(seller.sellerId) : undefined}
                  canFulfillAll={canFulfillAll}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
