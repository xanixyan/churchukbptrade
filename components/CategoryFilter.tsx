"use client";

import { BLUEPRINT_TYPES, BlueprintType } from "@/lib/types";

interface CategoryFilterProps {
  selected: BlueprintType | null;
  onChange: (category: BlueprintType | null) => void;
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All button */}
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
          selected === null
            ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
            : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-cyan/30 hover:text-gray-300"
        }`}
      >
        Всі
      </button>

      {/* Category buttons */}
      {BLUEPRINT_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            selected === type
              ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
              : "bg-dark-700 text-gray-400 border border-dark-600 hover:border-neon-cyan/30 hover:text-gray-300"
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}
