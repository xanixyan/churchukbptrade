"use client";

import { BlueprintType } from "@/lib/types";
import CategoryFilter from "./CategoryFilter";

interface CatalogControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  showOwnedOnly: boolean;
  onShowOwnedOnlyChange: (value: boolean) => void;
  categoryFilter: BlueprintType | null;
  onCategoryFilterChange: (category: BlueprintType | null) => void;
  totalCount: number;
  shownCount: number;
  // Select mode props (legacy)
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  selectedCount?: number;
  // Cart mode props
  cartItemCount?: number;
  onEnterCartMode?: () => void;
  isCartMode?: boolean;
}

export default function CatalogControls({
  search,
  onSearchChange,
  showOwnedOnly,
  onShowOwnedOnlyChange,
  categoryFilter,
  onCategoryFilterChange,
  totalCount,
  shownCount,
  selectMode = false,
  onToggleSelectMode,
  selectedCount = 0,
  cartItemCount = 0,
  onEnterCartMode,
  isCartMode = false,
}: CatalogControlsProps) {
  return (
    <div className="bg-dark-800 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
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
              placeholder="Пошук за назвою або ID..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:border-neon-cyan/50"
            />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Cart mode button - main action */}
          {onEnterCartMode && (
            <button
              onClick={onEnterCartMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isCartMode
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                  : "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 hover:border-neon-cyan/50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {isCartMode ? "Готово" : "Обрати кілька"}
              {cartItemCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-neon-cyan/30 rounded text-xs">
                  {cartItemCount}
                </span>
              )}
            </button>
          )}

          {/* Legacy select mode toggle button (hidden when cart mode is available) */}
          {onToggleSelectMode && !onEnterCartMode && (
            <button
              onClick={onToggleSelectMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectMode
                  ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/40"
                  : "bg-dark-700 text-gray-300 border border-dark-600 hover:border-neon-purple/40 hover:text-neon-purple"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              {selectMode ? "Вийти з вибору" : "Обрати"}
              {selectMode && selectedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-neon-purple/30 rounded text-xs">
                  {selectedCount}
                </span>
              )}
            </button>
          )}

          {/* Owned only toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={showOwnedOnly}
                onChange={(e) => onShowOwnedOnlyChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-dark-600 rounded-full peer peer-checked:bg-neon-cyan/30 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-neon-cyan"></div>
            </div>
            <span className="text-sm text-gray-300">Тільки креслення в наявності</span>
          </label>
        </div>
      </div>

      {/* Category filter */}
      <div className="mt-4">
        <CategoryFilter selected={categoryFilter} onChange={onCategoryFilterChange} />
      </div>

      {/* Count */}
      <div className="mt-3 text-sm text-gray-500">
        Показано <span className="text-neon-cyan font-medium">{shownCount}</span> з{" "}
        <span className="text-white">{totalCount}</span> креслень
      </div>
    </div>
  );
}
