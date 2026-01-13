"use client";

import { useState, useEffect, useMemo } from "react";
import { BlueprintSelection } from "@/lib/types";
import { buildPurchaseMessage, getTotalItemCount } from "@/lib/message-builder";

interface BuyModalProps {
  // Accepts array of blueprint selections with quantities
  selections: BlueprintSelection[];
  isOpen: boolean;
  onClose: () => void;
}

export default function BuyModal({ selections, isOpen, onClose }: BuyModalProps) {
  const [copied, setCopied] = useState(false);

  // Build message using centralized helper
  const message = useMemo(() => buildPurchaseMessage(selections), [selections]);

  // Calculate totals for display
  const totalTypes = selections.length;
  const totalItems = useMemo(() => getTotalItemCount(selections), [selections]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || selections.length === 0) return null;

  // Dynamic title based on count
  const title = totalTypes === 1
    ? `Купити креслення (×${totalItems})`
    : `Купити креслення (${totalTypes} типів, ${totalItems} шт.)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 rounded-xl max-w-lg w-full border border-dark-600 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600 shrink-0">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <p className="text-sm text-gray-400 mb-3">
            Скопіюй це повідомлення та надішли мені в Discord:
          </p>

          <textarea
            readOnly
            value={message}
            className="w-full p-3 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white font-mono resize-none focus:outline-none"
            style={{ minHeight: "200px", height: `${Math.min(200 + selections.length * 24, 350)}px` }}
          />

          <button
            onClick={handleCopy}
            className={`w-full mt-4 py-3 px-4 rounded-lg font-medium transition-all ${
              copied
                ? "bg-green-600 text-white"
                : "neon-btn text-black hover:opacity-90"
            }`}
          >
            {copied ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Скопійовано!
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Скопіювати повідомлення
              </span>
            )}
          </button>

          <p className="mt-4 text-sm text-gray-400 text-center">
            Потім відкрий Discord та напиши:{" "}
            <span className="text-white font-medium">churchuk</span>
            <br />
            <span className="text-xs text-gray-500">(встав через Ctrl+V)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
