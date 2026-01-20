"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { BlueprintSelectionWithSeller, formatItemPrice } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

interface CheckoutModalWithSellerProps {
  selections: BlueprintSelectionWithSeller[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FormState = "idle" | "submitting" | "success" | "error";

export default function CheckoutModalWithSeller({
  selections,
  isOpen,
  onClose,
  onSuccess,
}: CheckoutModalWithSellerProps) {
  // Auth state - check if buyer is logged in
  const { isAuthenticated, role, user } = useAuth();
  const isLoggedInBuyer = isAuthenticated && role === "buyer" && user?.discordId;

  // Form state
  const [discordNick, setDiscordNick] = useState("");
  const [offer, setOffer] = useState("");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Anti-bot field

  // UI state
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Calculate totals for display
  const totalTypes = selections.length;
  const totalItems = useMemo(
    () => selections.reduce((sum, s) => sum + s.quantity, 0),
    [selections]
  );
  // Note: We can't sum prices anymore since they can be in different units (springs, seeds, blueprints, etc.)

  // Check if any selection has negotiable price (requires offer)
  const hasNegotiablePrice = useMemo(() => {
    return selections.some(
      (s) => !s.priceSnapshot || s.priceSnapshot.type === "Договірна"
    );
  }, [selections]);

  // Determine if offer is required (only when all prices are negotiable)
  const isOfferRequired = hasNegotiablePrice;

  // Text limits
  const MAX_OFFER_LENGTH = 500;
  const MAX_NOTES_LENGTH = 500;

  // Get effective Discord nickname (from session for logged-in buyers, from input for guests)
  const effectiveDiscordNick = isLoggedInBuyer ? user.discordId : discordNick.trim();

  // Form validation
  const isFormValid = useMemo(() => {
    // Discord validation: for logged-in buyers, always valid (uses session)
    // For guests: must be filled
    const discordValid = isLoggedInBuyer || (discordNick.trim().length > 0 && discordNick.trim().length <= 64);

    // Offer validation: required only for negotiable prices
    const offerValid = isOfferRequired
      ? offer.trim().length > 0 && offer.trim().length <= MAX_OFFER_LENGTH
      : offer.trim().length <= MAX_OFFER_LENGTH;

    return (
      discordValid &&
      offerValid &&
      notes.trim().length <= MAX_NOTES_LENGTH &&
      selections.length > 0
    );
  }, [discordNick, offer, notes, selections, isLoggedInBuyer, isOfferRequired]);

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isFormValid || formState === "submitting") return;

    setFormState("submitting");
    setErrorMessage("");

    // Build order items with seller info
    const items = selections.map((s) => ({
      id: s.blueprint.id,
      name: s.blueprint.name,
      quantity: s.quantity,
      sellerId: s.sellerId,
      sellerDiscordId: s.sellerDiscordId,
      priceSnapshot: s.priceSnapshot,
    }));

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include session cookie for buyer auth
        body: JSON.stringify({
          discordNick: effectiveDiscordNick,
          offer: offer.trim() || undefined, // Allow empty for non-negotiable prices
          notes: notes.trim() || undefined,
          items,
          website: honeypot, // Honeypot field
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFormState("success");
        // Auto-close after success
        setTimeout(() => {
          onSuccess();
          resetForm();
        }, 2000);
      } else {
        setFormState("error");
        setErrorMessage(data.error || "Помилка відправки замовлення");
      }
    } catch (error) {
      console.error("Order submit error:", error);
      setFormState("error");
      setErrorMessage("Помилка з'єднання. Перевірте інтернет.");
    }
  };

  // Reset form
  const resetForm = () => {
    setDiscordNick("");
    setOffer("");
    setNotes("");
    setHoneypot("");
    setFormState("idle");
    setErrorMessage("");
  };

  // Handle close
  const handleClose = () => {
    if (formState === "submitting") return; // Prevent closing during submission
    onClose();
    // Reset form after animation
    setTimeout(resetForm, 300);
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && formState !== "submitting") {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, formState]);

  if (!isOpen || selections.length === 0) return null;

  // Dynamic title based on count
  const title =
    totalTypes === 1
      ? `Оформити замовлення (×${totalItems})`
      : `Оформити замовлення (${totalTypes} типів, ${totalItems} шт.)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop bg-black/70"
      onClick={handleClose}
    >
      <div
        className="bg-dark-800 rounded-xl max-w-lg w-full border border-dark-600 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600 shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={handleClose}
            disabled={formState === "submitting"}
            className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {/* Success state */}
          {formState === "success" ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-600/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">
                Замовлення відправлено!
              </h4>
              <p className="text-gray-400">Продавець зв'яжеться з вами в Discord найближчим часом.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Order summary with seller info */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Ваше замовлення:
                </label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {selections.map((s) => (
                    <div
                      key={`${s.blueprint.slug}-${s.sellerId}`}
                      className="py-2 border-b border-dark-600 last:border-b-0"
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white font-medium">{s.blueprint.name}</span>
                        <span className="text-neon-cyan">×{s.quantity}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-xs">
                        <span className="text-gray-500">
                          Продавець: <span className="text-gray-400">{s.sellerDiscordId}</span>
                        </span>
                        <span className="text-neon-purple">
                          {formatItemPrice(s.priceSnapshot)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Note: Total price removed - prices can be in different units and cannot be summed */}
              </div>

              {/* Discord nickname - hidden for logged-in buyers */}
              {isLoggedInBuyer ? (
                <div className="mb-4 p-3 bg-dark-700 border border-dark-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-neon-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-gray-400 text-sm">Замовлення від:</span>
                    <span className="text-neon-cyan font-medium">{user.discordId}</span>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <label
                    htmlFor="discordNick"
                    className="block text-sm font-medium text-gray-400 mb-2"
                  >
                    Ваш Discord нікнейм <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="discordNick"
                    value={discordNick}
                    onChange={(e) => setDiscordNick(e.target.value)}
                    placeholder="username або username#1234"
                    maxLength={64}
                    required
                    disabled={formState === "submitting"}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors disabled:opacity-50"
                  />
                </div>
              )}

              {/* Offer - required only for negotiable prices */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="offer"
                    className="text-sm font-medium text-gray-400"
                  >
                    Що пропонуєте взамін{" "}
                    {isOfferRequired ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-gray-600">(опціонально)</span>
                    )}
                  </label>
                  <span className={`text-xs ${offer.length > MAX_OFFER_LENGTH ? 'text-red-400' : offer.length > MAX_OFFER_LENGTH * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {offer.length}/{MAX_OFFER_LENGTH}
                  </span>
                </div>
                <textarea
                  id="offer"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder={
                    isOfferRequired
                      ? "Опишіть вашу пропозицію…"
                      : "Необов'язково: якщо хочете запропонувати іншу ціну/обмін…"
                  }
                  maxLength={MAX_OFFER_LENGTH}
                  required={isOfferRequired}
                  rows={2}
                  disabled={formState === "submitting"}
                  className={`w-full px-3 py-2 bg-dark-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors resize-none disabled:opacity-50 ${offer.length > MAX_OFFER_LENGTH ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-neon-cyan'}`}
                />
                {offer.length > MAX_OFFER_LENGTH && (
                  <p className="mt-1 text-xs text-red-400">Пропозиція занадто довга (макс. {MAX_OFFER_LENGTH} символів)</p>
                )}
                {/* Hint based on price type */}
                <p className="mt-1 text-xs text-gray-500">
                  {isOfferRequired
                    ? "Потрібна ваша пропозиція для договірної ціни"
                    : "Можна залишити порожнім, якщо погоджуєтесь з ціною"}
                </p>
              </div>

              {/* Notes (optional) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="notes"
                    className="text-sm font-medium text-gray-400"
                  >
                    Примітки <span className="text-gray-600">(опціонально)</span>
                  </label>
                  <span className={`text-xs ${notes.length > MAX_NOTES_LENGTH ? 'text-red-400' : notes.length > MAX_NOTES_LENGTH * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {notes.length}/{MAX_NOTES_LENGTH}
                  </span>
                </div>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Зручний час для обміну, додаткова інформація..."
                  maxLength={MAX_NOTES_LENGTH}
                  rows={2}
                  disabled={formState === "submitting"}
                  className={`w-full px-3 py-2 bg-dark-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors resize-none disabled:opacity-50 ${notes.length > MAX_NOTES_LENGTH ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-neon-cyan'}`}
                />
                {notes.length > MAX_NOTES_LENGTH && (
                  <p className="mt-1 text-xs text-red-400">Примітки занадто довгі (макс. {MAX_NOTES_LENGTH} символів)</p>
                )}
              </div>

              {/* Honeypot field (hidden from users, visible to bots) */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Error message */}
              {formState === "error" && errorMessage && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!isFormValid || formState === "submitting"}
                className={`w-full py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                  isFormValid && formState !== "submitting"
                    ? "neon-btn text-black hover:opacity-90"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                {formState === "submitting" ? (
                  <>
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Відправляю...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    Оформити замовлення
                  </>
                )}
              </button>

              <p className="mt-4 text-xs text-gray-500 text-center">
                Після оформлення продавець отримає повідомлення та напише вам в Discord
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
