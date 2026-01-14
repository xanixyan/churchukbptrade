// Blueprint categories
export const BLUEPRINT_TYPES = [
  "Guns",
  "Augments",
  "Utility",
  "Heals",
  "Grenades",
  "Attachments",
] as const;

export type BlueprintType = (typeof BLUEPRINT_TYPES)[number];

export interface Blueprint {
  id: string;
  name: string;
  slug: string;
  image: string;
  type: BlueprintType;
  owned: boolean;
  ownedQty: number;
  notes?: string;
}

/**
 * Validate blueprint type
 */
export function isValidBlueprintType(type: unknown): type is BlueprintType {
  return typeof type === "string" && BLUEPRINT_TYPES.includes(type as BlueprintType);
}

/**
 * Validate and normalize ownedQty value
 * - Clamps to integer >= 0
 * - If owned=false, returns 0
 * - If owned=true and qty < 1, returns 1
 */
export function normalizeOwnedQty(owned: boolean, qty: unknown): number {
  // Parse to number, default to 0
  let value = typeof qty === "number" ? qty : parseInt(String(qty), 10);
  if (isNaN(value) || value < 0) {
    value = 0;
  }
  value = Math.floor(value);

  // If not owned, qty must be 0
  if (!owned) {
    return 0;
  }

  // If owned, qty must be at least 1
  if (value < 1) {
    return 1;
  }

  return value;
}

/**
 * Get the maximum selectable quantity for a blueprint
 */
export function getMaxSelectableQty(blueprint: Blueprint): number {
  return blueprint.owned ? blueprint.ownedQty : 0;
}

// Selection with quantity for multi-select feature
export interface BlueprintSelection {
  blueprint: Blueprint;
  quantity: number;
}
