"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { BlueprintSelection } from "@/lib/types";
import { getTotalItemCount } from "@/lib/message-builder";
import { OrderItem } from "@/lib/order";

interface CheckoutModalProps {
  selections: BlueprintSelection[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FormState = "idle" | "submitting" | "success" | "error";

export default function CheckoutModal({
  selections,
  isOpen,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
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
  const totalItems = useMemo(() => getTotalItemCount(selections), [selections]);

  // Text limits
  const MAX_OFFER_LENGTH = 500;
  const MAX_NOTES_LENGTH = 500;

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      discordNick.trim().length > 0 &&
      discordNick.trim().length <= 64 &&
      offer.trim().length > 0 &&
      offer.trim().length <= MAX_OFFER_LENGTH &&
      notes.trim().length <= MAX_NOTES_LENGTH &&
      selections.length > 0
    );
  }, [discordNick, offer, notes, selections]);

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isFormValid || formState === "submitting") return;

    setFormState("submitting");
    setErrorMessage("");

    // Build order items
    const items: OrderItem[] = selections.map((s) => ({
      id: s.blueprint.id,
      name: s.blueprint.name,
      quantity: s.quantity,
    }));

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          discordNick: discordNick.trim(),
          offer: offer.trim(),
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
              <p className="text-gray-400">Я зв'яжуся з вами в Discord найближчим часом.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Order summary */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Ваше замовлення:
                </label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {selections.map((s) => (
                    <div
                      key={s.blueprint.slug}
                      className="flex justify-between items-center py-1 text-sm"
                    >
                      <span className="text-white">{s.blueprint.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-neon-cyan">×{s.quantity}</span>
                        <span className="text-gray-500 text-xs">
                          (з {s.blueprint.ownedQty})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discord nickname */}
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

              {/* Offer */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="offer"
                    className="text-sm font-medium text-gray-400"
                  >
                    Що пропонуєте взамін <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${offer.length > MAX_OFFER_LENGTH ? 'text-red-400' : offer.length > MAX_OFFER_LENGTH * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {offer.length}/{MAX_OFFER_LENGTH}
                  </span>
                </div>
                <textarea
                  id="offer"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="Наприклад: 500 ARC, інше креслення, тощо"
                  maxLength={MAX_OFFER_LENGTH}
                  required
                  rows={2}
                  disabled={formState === "submitting"}
                  className={`w-full px-3 py-2 bg-dark-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors resize-none disabled:opacity-50 ${offer.length > MAX_OFFER_LENGTH ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-neon-cyan'}`}
                />
                {offer.length > MAX_OFFER_LENGTH && (
                  <p className="mt-1 text-xs text-red-400">Пропозиція занадто довга (макс. {MAX_OFFER_LENGTH} символів)</p>
                )}
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
                Після оформлення я отримаю повідомлення та напишу вам в Discord
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
