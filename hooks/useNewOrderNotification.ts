"use client";

import { useRef, useCallback, useEffect } from "react";

interface OrderWithId {
  orderId: string;
  claimableItemCount?: number;
}

/**
 * Hook for playing notification sound when new actionable orders arrive
 *
 * Features:
 * - Tracks seen order IDs in memory (not persistent)
 * - Only plays sound for truly new orders with claimable items
 * - Handles browser autoplay restrictions
 * - Initializes silently on first fetch (no sound on page load)
 */
export function useNewOrderNotification() {
  // Track seen order IDs
  const seenOrderIds = useRef<Set<string>>(new Set());

  // Track if audio has been unlocked (browser autoplay restriction)
  const audioUnlocked = useRef(false);

  // Track if this is the initial fetch (don't play sound on first load)
  const isInitialFetch = useRef(true);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Initialize the audio element
   * Should be called once when the component mounts
   */
  const initAudio = useCallback(() => {
    if (typeof window === "undefined") return;

    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/ringtone-sms-notification.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);

  /**
   * Unlock audio playback after user interaction
   * Browsers require user interaction before allowing audio playback
   */
  const unlockAudio = useCallback(() => {
    if (audioUnlocked.current || !audioRef.current) return;

    // Play and immediately pause to "unlock" the audio
    audioRef.current.play()
      .then(() => {
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
        audioUnlocked.current = true;
      })
      .catch(() => {
        // Silently fail - audio not unlocked yet
      });
  }, []);

  /**
   * Play the notification sound
   * Only plays if audio has been unlocked
   */
  const playSound = useCallback(() => {
    if (!audioUnlocked.current || !audioRef.current) return;

    // Reset to start and play
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Silently fail if playback fails
    });
  }, []);

  /**
   * Process new orders and play sound if there are new actionable ones
   *
   * @param orders - The current list of orders from the API
   * @returns true if new orders were detected, false otherwise
   */
  const processOrders = useCallback((orders: OrderWithId[]): boolean => {
    // Get IDs of actionable orders (those with at least one claimable item)
    const actionableOrderIds = orders
      .filter((order) => (order.claimableItemCount ?? 0) > 0)
      .map((order) => order.orderId);

    // Find truly new orders (not in seen set)
    const newOrderIds = actionableOrderIds.filter(
      (id) => !seenOrderIds.current.has(id)
    );

    // Update seen orders with ALL current order IDs (not just actionable)
    orders.forEach((order) => seenOrderIds.current.add(order.orderId));

    // On initial fetch, just initialize the seen set without playing sound
    if (isInitialFetch.current) {
      isInitialFetch.current = false;
      return false;
    }

    // Play sound if there are new actionable orders
    if (newOrderIds.length > 0) {
      playSound();
      return true;
    }

    return false;
  }, [playSound]);

  /**
   * Reset the notification state
   * Call this when the seller logs out
   */
  const reset = useCallback(() => {
    seenOrderIds.current.clear();
    isInitialFetch.current = true;
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    initAudio,
    unlockAudio,
    processOrders,
    reset,
  };
}
