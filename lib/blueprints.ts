import fs from "fs";
import path from "path";
import { Blueprint, BlueprintType, normalizeOwnedQty, isValidBlueprintType } from "./types";

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
}

/**
 * Parse and validate a raw blueprint object
 */
function parseBlueprint(data: RawBlueprint, filename: string): Blueprint | null {
  // Validate required fields
  if (!data.id || !data.name || !data.slug) {
    console.warn(`Blueprint ${filename}: missing required fields (id, name, slug)`);
    return null;
  }

  const owned = Boolean(data.owned);
  const ownedQty = normalizeOwnedQty(owned, data.ownedQty);

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
    owned,
    ownedQty,
    notes: data.notes || "",
  };
}

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

export function getBlueprintBySlug(slug: string): Blueprint | null {
  const blueprints = getAllBlueprints();
  return blueprints.find((bp) => bp.slug === slug) || null;
}

export function getAllBlueprintSlugs(): string[] {
  const blueprints = getAllBlueprints();
  return blueprints.map((bp) => bp.slug);
}
