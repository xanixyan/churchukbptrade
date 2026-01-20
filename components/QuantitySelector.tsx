"use client";

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  max?: number;
}

export default function QuantitySelector({
  quantity,
  onChange,
  disabled = false,
  size = "sm",
  max = 999,
}: QuantitySelectorProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      onChange(quantity - 1);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= max) {
      onChange(value);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const sizeClasses = size === "sm"
    ? "h-6 text-xs"
    : "h-8 text-sm";

  const buttonClasses = size === "sm"
    ? "w-6 h-6"
    : "w-8 h-8";

  const inputClasses = size === "sm"
    ? "w-8 text-xs"
    : "w-12 text-sm";

  return (
    <div
      className={`flex items-center gap-0.5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onClick={handleClick}
    >
      {/* Decrement button */}
      <button
        onClick={handleDecrement}
        disabled={disabled || quantity <= 1}
        className={`${buttonClasses} flex items-center justify-center rounded-l bg-dark-600 text-gray-300 hover:bg-dark-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-dark-500`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Quantity input */}
      <input
        type="number"
        min="1" max={max}
        value={quantity}
        onChange={handleInputChange}
        onClick={handleClick}
        disabled={disabled}
        className={`${inputClasses} ${sizeClasses} text-center bg-dark-700 text-white border-y border-dark-500 focus:outline-none focus:border-neon-cyan/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />

      {/* Increment button */}
      <button
        onClick={handleIncrement}
        disabled={disabled || quantity >= max}
        className={`${buttonClasses} flex items-center justify-center rounded-r bg-dark-600 text-gray-300 hover:bg-dark-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-dark-500`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
