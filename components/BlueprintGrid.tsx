"use client";

import { useState, useMemo, useCallback } from "react";
import { Blueprint, BlueprintSelection, BlueprintType } from "@/lib/types";
import { getTotalItemCount } from "@/lib/message-builder";
import BlueprintCard from "./BlueprintCard";
import CatalogControls from "./CatalogControls";
import SelectionBar from "./SelectionBar";
import CheckoutModal from "./CheckoutModal";
import SellerPickerModal from "./SellerPickerModal";
import { useCart } from "@/contexts/CartContext";

interface BlueprintGridProps {
  blueprints: Blueprint[];
}

export default function BlueprintGrid({ blueprints }: BlueprintGridProps) {
  const [search, setSearch] = useState("");
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<BlueprintType | null>(null);

  // Multi-select state with quantities (legacy mode)
  const [selectMode, setSelectMode] = useState(false);
  const [selections, setSelections] = useState<BlueprintSelection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cart integration
  const { isCartOpen, isMultiSelectMode, enterMultiSelectMode, exitMultiSelectMode, openCart, totalItems: cartTotalItems } = useCart();

  // Seller picker modal state
  const [sellerPickerBlueprint, setSellerPickerBlueprint] = useState<Blueprint | null>(null);

  const filteredBlueprints = useMemo(() => {
    let result = blueprints;

    // Filter by category
    if (categoryFilter) {
      result = result.filter((bp) => bp.type === categoryFilter);
    }

    // Filter by owned status
    if (showOwnedOnly) {
      result = result.filter((bp) => bp.owned);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        (bp) =>
          bp.name.toLowerCase().includes(query) ||
          bp.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [blueprints, search, showOwnedOnly, categoryFilter]);

  // Toggle blueprint selection
  const handleToggleSelect = useCallback((blueprint: Blueprint) => {
    setSelections((prev) => {
      const existingIndex = prev.findIndex((s) => s.blueprint.slug === blueprint.slug);
      if (existingIndex >= 0) {
        // Remove from selection
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // Add to selection with default quantity 1 (only if owned)
        if (blueprint.owned) {
          return [...prev, { blueprint, quantity: 1 }];
        }
        return prev;
      }
    });
  }, []);

  // Update quantity for a blueprint
  const handleQuantityChange = useCallback((blueprint: Blueprint, quantity: number) => {
    setSelections((prev) => {
      return prev.map((s) =>
        s.blueprint.slug === blueprint.slug
          ? { ...s, quantity: Math.max(1, quantity) }
          : s
      );
    });
  }, []);

  // Check if blueprint is selected
  const isSelected = useCallback(
    (blueprint: Blueprint) => selections.some((s) => s.blueprint.slug === blueprint.slug),
    [selections]
  );

  // Get quantity for a blueprint
  const getQuantity = useCallback(
    (blueprint: Blueprint) => {
      const selection = selections.find((s) => s.blueprint.slug === blueprint.slug);
      return selection?.quantity ?? 1;
    },
    [selections]
  );

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelections([]);
  }, []);

  // Toggle select mode
  const handleToggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        // Exiting select mode - clear selection
        setSelections([]);
      }
      return !prev;
    });
  }, []);

  // Open buy modal for selected blueprints
  const handleBuySelected = useCallback(() => {
    if (selections.length > 0) {
      setIsModalOpen(true);
    }
  }, [selections]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Handle successful order
  const handleOrderSuccess = useCallback(() => {
    setIsModalOpen(false);
    setSelections([]);
    setSelectMode(false);
  }, []);

  // Calculate totals
  const totalTypes = selections.length;
  const totalItems = useMemo(() => getTotalItemCount(selections), [selections]);

  // Toggle multi-select cart mode
  const handleToggleCartMode = useCallback(() => {
    if (isMultiSelectMode) {
      exitMultiSelectMode();
    } else {
      enterMultiSelectMode();
    }
  }, [isMultiSelectMode, enterMultiSelectMode, exitMultiSelectMode]);

  // Proceed to cart: open cart drawer and exit multi-select
  const handleProceedToCart = useCallback(() => {
    exitMultiSelectMode();
    openCart();
  }, [exitMultiSelectMode, openCart]);

  // Cancel multi-select without opening cart
  const handleCancelMultiSelect = useCallback(() => {
    exitMultiSelectMode();
  }, [exitMultiSelectMode]);

  // Handle opening seller picker for a blueprint
  const handleOpenSellerPicker = useCallback((blueprint: Blueprint) => {
    setSellerPickerBlueprint(blueprint);
  }, []);

  // Handle closing seller picker
  const handleCloseSellerPicker = useCallback(() => {
    setSellerPickerBlueprint(null);
  }, []);

  return (
    <div className={`${selectMode && selections.length > 0 ? "pb-20" : ""} ${isMultiSelectMode ? "pb-20" : ""} ${isCartOpen ? "lg:mr-[420px]" : ""} transition-all duration-300`}>
      <CatalogControls
        search={search}
        onSearchChange={setSearch}
        showOwnedOnly={showOwnedOnly}
        onShowOwnedOnlyChange={setShowOwnedOnly}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        totalCount={blueprints.length}
        shownCount={filteredBlueprints.length}
        // Select mode props (legacy)
        selectMode={selectMode}
        onToggleSelectMode={handleToggleSelectMode}
        selectedCount={totalTypes}
        // Cart mode props
        cartItemCount={cartTotalItems}
        onEnterCartMode={handleToggleCartMode}
        isCartMode={isMultiSelectMode}
      />

      {filteredBlueprints.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>Креслень не знайдено</p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-neon-cyan hover:underline"
              >
                Очистити пошук
              </button>
            )}
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="text-neon-cyan hover:underline"
              >
                Скинути категорію
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredBlueprints.map((bp) => (
            <BlueprintCard
              key={bp.slug}
              blueprint={bp}
              selectMode={selectMode}
              isSelected={isSelected(bp)}
              quantity={getQuantity(bp)}
              onToggleSelect={handleToggleSelect}
              onQuantityChange={handleQuantityChange}
              // Cart mode props
              isCartMode={isMultiSelectMode}
              onAddToCart={handleOpenSellerPicker}
            />
          ))}
        </div>
      )}

      {/* Floating selection bar */}
      {selectMode && (
        <SelectionBar
          totalTypes={totalTypes}
          totalItems={totalItems}
          onClearSelection={handleClearSelection}
          onBuySelected={handleBuySelected}
        />
      )}

      {/* Checkout modal for selected blueprints (legacy mode) */}
      <CheckoutModal
        selections={selections}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleOrderSuccess}
      />

      {/* Seller picker modal */}
      {sellerPickerBlueprint && (
        <SellerPickerModal
          blueprint={sellerPickerBlueprint}
          isOpen={true}
          onClose={handleCloseSellerPicker}
          initialQuantity={1}
        />
      )}

      {/* Multi-select floating action bar */}
      {isMultiSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-dark-800 border-t border-dark-600 shadow-2xl px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                Обрано:{" "}
                <span className="text-neon-cyan font-bold">{cartTotalItems}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelMultiSelect}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-lg transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleProceedToCart}
                disabled={cartTotalItems === 0}
                className="px-5 py-2 text-sm font-medium bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 rounded-lg hover:bg-neon-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Перейти до кошика
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
