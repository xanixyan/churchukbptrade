import fs from "fs";
import path from "path";
import { Blueprint } from "./types";

const BLUEPRINTS_DIR = path.join(process.cwd(), "content", "blueprints");

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
      const data = JSON.parse(content) as Blueprint;
      blueprints.push(data);
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
