"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { CartItem, ItemPrice } from "@/lib/types";

// Storage key for localStorage persistence
const CART_STORAGE_KEY = "churchuk_cart";

// Generate unique cart item ID
function generateCartItemId(): string {
  return `ci_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Cart context interface
interface CartContextType {
  // State
  items: CartItem[];
  isCartOpen: boolean;
  isMultiSelectMode: boolean;

  // Cart item operations
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemOffer: (itemId: string, offerText: string) => void;
  clearCart: () => void;

  // Cart panel operations
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Multi-select mode operations
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;

  // Computed values
  totalItems: number;
  totalQuantity: number;
  hasNegotiableItems: boolean;
  allNegotiableItemsHaveOffers: boolean;
  getItemsByBlueprint: (blueprintId: string) => CartItem[];
  getItemsBySeller: (sellerId: string) => CartItem[];
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load cart from storage:", error);
    }
    setIsInitialized(true);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error("Failed to save cart to storage:", error);
      }
    }
  }, [items, isInitialized]);

  // Add item to cart
  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    const newItem: CartItem = {
      ...item,
      id: generateCartItemId(),
    };

    setItems((prev) => {
      // Check if same blueprint + same seller already exists
      const existingIndex = prev.findIndex(
        (i) => i.blueprintId === item.blueprintId && i.sellerId === item.sellerId
      );

      if (existingIndex >= 0) {
        // Update existing item quantity
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      // Add new item
      return [...prev, newItem];
    });
  }, []);

  // Remove item from cart
  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  // Update item offer text
  const updateItemOffer = useCallback((itemId: string, offerText: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, buyerOfferText: offerText } : item
      )
    );
  }, []);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Cart panel operations
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  // Multi-select mode operations
  const enterMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(true);
    setIsCartOpen(true);
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setIsCartOpen(false);
  }, []);

  // Computed values
  const totalItems = useMemo(() => items.length, [items]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const hasNegotiableItems = useMemo(
    () => items.some((item) => !item.priceSnapshot || item.priceSnapshot.type === "Договірна"),
    [items]
  );

  const allNegotiableItemsHaveOffers = useMemo(() => {
    const negotiableItems = items.filter(
      (item) => !item.priceSnapshot || item.priceSnapshot.type === "Договірна"
    );
    return negotiableItems.every(
      (item) => item.buyerOfferText && item.buyerOfferText.trim().length > 0
    );
  }, [items]);

  const getItemsByBlueprint = useCallback(
    (blueprintId: string) => items.filter((item) => item.blueprintId === blueprintId),
    [items]
  );

  const getItemsBySeller = useCallback(
    (sellerId: string) => items.filter((item) => item.sellerId === sellerId),
    [items]
  );

  const value: CartContextType = {
    items,
    isCartOpen,
    isMultiSelectMode,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemOffer,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    enterMultiSelectMode,
    exitMultiSelectMode,
    totalItems,
    totalQuantity,
    hasNegotiableItems,
    allNegotiableItemsHaveOffers,
    getItemsByBlueprint,
    getItemsBySeller,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
