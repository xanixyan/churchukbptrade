import fs from "fs";
import path from "path";
import { Blueprint, BlueprintType, isValidBlueprintType } from "./types";
import { getAggregatedInventory } from "./sellers";

const BLUEPRINTS_DIR = path.join(process.cwd(), "content", "blueprints");

interface RawBlueprint {
  id?: string;
  name?: string;
  slug?: string;
  image?: string;
  type?: string;
  owned?: boolean;
  ownedQty?: number;
  notes?: string;
  updatedAt?: string;
}

// Blueprint with aggregated inventory from all sellers
export interface BlueprintWithInventory extends Blueprint {
  totalQty: number; // Total quantity across all active sellers
  available: boolean; // True if any seller has this blueprint
  sellerCount: number; // Number of sellers that have this blueprint
}

/**
 * Parse and validate a raw blueprint object (catalog data only)
 */
function parseBlueprint(data: RawBlueprint, filename: string): Blueprint | null {
  // Validate required fields
  if (!data.id || !data.name || !data.slug) {
    console.warn(`Blueprint ${filename}: missing required fields (id, name, slug)`);
    return null;
  }

  // Validate and default type
  let type: BlueprintType = "Utility"; // Default type
  if (isValidBlueprintType(data.type)) {
    type = data.type;
  } else if (data.type) {
    console.warn(`Blueprint ${filename}: invalid type "${data.type}", defaulting to "Utility"`);
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    image: data.image || "",
    type,
    notes: data.notes || "",
    // Include legacy stock fields from JSON files
    owned: data.owned || false,
    ownedQty: data.ownedQty || 0,
  };
}

/**
 * Get all blueprints from the catalog (base data without inventory)
 */
export function getAllBlueprints(): Blueprint[] {
  if (!fs.existsSync(BLUEPRINTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BLUEPRINTS_DIR).filter((f) => f.endsWith(".json"));

  const blueprints: Blueprint[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(BLUEPRINTS_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as RawBlueprint;
      const blueprint = parseBlueprint(data, file);
      if (blueprint) {
        blueprints.push(blueprint);
      }
    } catch (error) {
      console.error(`Error reading blueprint file ${file}:`, error);
    }
  }

  return blueprints.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all blueprints with aggregated inventory from all active sellers
 * This is used for the public catalog display
 *
 * Availability is calculated by combining:
 * - Legacy/global stock from blueprint JSON files (bp.ownedQty)
 * - Active seller inventory quantities
 */
export function getAllBlueprintsWithInventory(): BlueprintWithInventory[] {
  const blueprints = getAllBlueprints();
  const aggregatedInventory = getAggregatedInventory();

  return blueprints.map((bp) => {
    const inventoryData = aggregatedInventory.get(bp.id);
    const sellerQty = inventoryData?.totalQty || 0;
    const legacyQty = bp.ownedQty || 0;

    // Total quantity combines legacy stock and seller inventory
    const totalQty = sellerQty + legacyQty;

    return {
      ...bp,
      totalQty,
      available: totalQty > 0,
      sellerCount: inventoryData?.sellers.length || 0,
      // Legacy compatibility fields - expose combined quantity
      owned: totalQty > 0,
      ownedQty: totalQty,
    };
  });
}

/**
 * Get blueprint by slug
 */
export function getBlueprintBySlug(slug: string): Blueprint | null {
  const blueprints = getAllBlueprints();
  return blueprints.find((bp) => bp.slug === slug) || null;
}

/**
 * Get blueprint by slug with inventory
 */
export function getBlueprintBySlugWithInventory(slug: string): BlueprintWithInventory | null {
  const blueprints = getAllBlueprintsWithInventory();
  return blueprints.find((bp) => bp.slug === slug) || null;
}

/**
 * Get blueprint by ID
 */
export function getBlueprintById(id: string): Blueprint | null {
  const blueprints = getAllBlueprints();
  return blueprints.find((bp) => bp.id === id) || null;
}

/**
 * Get all blueprint slugs
 */
export function getAllBlueprintSlugs(): string[] {
  const blueprints = getAllBlueprints();
  return blueprints.map((bp) => bp.slug);
}

/**
 * Get the most recent updatedAt timestamp from all blueprints
 */
export function getLastUpdatedTime(): string | null {
  if (!fs.existsSync(BLUEPRINTS_DIR)) {
    return null;
  }

  const files = fs.readdirSync(BLUEPRINTS_DIR).filter((f) => f.endsWith(".json"));
  let latestTime: string | null = null;

  for (const file of files) {
    try {
      const filePath = path.join(BLUEPRINTS_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content) as RawBlueprint;

      if (data.updatedAt) {
        if (!latestTime || data.updatedAt > latestTime) {
          latestTime = data.updatedAt;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return latestTime;
}
