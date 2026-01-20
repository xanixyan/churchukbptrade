"use client";

interface SelectionBarProps {
  totalTypes: number;
  totalItems: number;
  onClearSelection: () => void;
  onBuySelected: () => void;
}

export default function SelectionBar({
  totalTypes,
  totalItems,
  onClearSelection,
  onBuySelected,
}: SelectionBarProps) {
  const hasSelection = totalTypes > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-dark-800 border-t border-dark-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Selection info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              {/* Types count */}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                  <span className="text-neon-cyan font-bold text-sm">{totalTypes}</span>
                </div>
                <span className="text-gray-400 text-sm">
                  {totalTypes === 1 ? "тип" : "типів"}
                </span>
              </div>

              {/* Separator */}
              <span className="text-gray-600">/</span>

              {/* Items count */}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-neon-purple/20 flex items-center justify-center">
                  <span className="text-neon-purple font-bold text-sm">{totalItems}</span>
                </div>
                <span className="text-gray-400 text-sm">
                  {totalItems === 1 ? "шт." : "шт."}
                </span>
              </div>
            </div>

            {/* Clear button */}
            {hasSelection && (
              <button
                onClick={onClearSelection}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Очистити
              </button>
            )}
          </div>

          {/* Buy button */}
          <button
            onClick={onBuySelected}
            disabled={!hasSelection}
            className={`py-2.5 px-6 rounded-lg font-bold flex items-center gap-2 transition-all ${
              hasSelection
                ? "neon-btn text-black"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Купити обране
          </button>
        </div>
      </div>
    </div>
  );
}
