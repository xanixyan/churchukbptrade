#!/usr/bin/env node

/**
 * ARC Raiders Blueprint Importer
 * ==============================
 *
 * Fetches ALL blueprints from the Fandom wiki and generates JSON files
 * for Decap CMS in /content/blueprints/.
 *
 * Usage: npm run import:blueprints
 *
 * Source: https://arc-raiders.fandom.com/wiki/Blueprints
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "..", "content", "blueprints");
const FANDOM_URL = "https://arc-raiders.fandom.com/wiki/Blueprints";

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const log = {
  info: (msg) => console.log(`  ${msg}`),
  success: (msg) => console.log(`  ✓ ${msg}`),
  warn: (msg) => console.log(`  ⚠ ${msg}`),
  error: (msg) => console.log(`  ✗ ${msg}`),
  created: (msg) => console.log(`  + ${msg}`),
  updated: (msg) => console.log(`  ↻ ${msg}`),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a URL-safe slug from a blueprint name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[''""`]/g, "")          // Remove quotes
    .replace(/[^a-z0-9\s-]/g, "")     // Remove special chars
    .replace(/\s+/g, "-")             // Spaces to hyphens
    .replace(/-+/g, "-")              // Multiple hyphens to single
    .replace(/^-+|-+$/g, "");         // Trim hyphens
}

/**
 * Generate blueprint ID: BP-001, BP-002, etc.
 */
function generateId(index) {
  return `BP-${String(index + 1).padStart(3, "0")}`;
}

/**
 * Normalize Fandom image URL to get highest resolution
 * Removes /revision/... and scaling parameters
 */
function normalizeImageUrl(url) {
  if (!url) return "";

  // Handle protocol-relative URLs
  if (url.startsWith("//")) {
    url = "https:" + url;
  }

  // Must be a Fandom/Wikia image
  if (!url.includes("static.wikia.nocookie.net") && !url.includes("vignette.wikia.nocookie.net")) {
    return "";
  }

  // Remove /revision/... part to get original image
  url = url.split("/revision/")[0];

  // Remove /scale-to-width-down/...
  url = url.replace(/\/scale-to-width-down\/\d+/, "");
  url = url.replace(/\/scale-to-width\/\d+/, "");

  // Remove query parameters
  url = url.split("?")[0];

  return url;
}

/**
 * Extract the best image URL from various attributes
 */
function extractBestImageUrl(imgTag) {
  // Priority: data-src (lazy loaded high-res) > srcset > src

  // Try data-src first (lazy loading, usually high-res)
  let dataSrc = imgTag.match(/data-src="([^"]+)"/i);
  if (dataSrc) {
    return normalizeImageUrl(dataSrc[1]);
  }

  // Try srcset for highest resolution
  let srcset = imgTag.match(/srcset="([^"]+)"/i);
  if (srcset) {
    // Parse srcset and get highest resolution
    const sources = srcset[1].split(",").map((s) => {
      const parts = s.trim().split(/\s+/);
      const url = parts[0];
      const width = parseInt(parts[1]) || 0;
      return { url, width };
    });
    sources.sort((a, b) => b.width - a.width);
    if (sources.length > 0) {
      return normalizeImageUrl(sources[0].url);
    }
  }

  // Fallback to src
  let src = imgTag.match(/src="([^"]+)"/i);
  if (src) {
    return normalizeImageUrl(src[1]);
  }

  return "";
}

/**
 * Fetch HTML with proper headers
 */
async function fetchHtml(url) {
  console.log(`\n📡 Fetching: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    log.success(`Fetched ${(html.length / 1024).toFixed(1)} KB`);
    return html;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Read existing blueprint JSON if it exists
 */
function readExistingBlueprint(slug) {
  const filePath = path.join(CONTENT_DIR, `${slug}.json`);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Write blueprint to JSON file
 */
function writeBlueprint(blueprint) {
  const filePath = path.join(CONTENT_DIR, `${blueprint.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(blueprint, null, 2) + "\n", "utf-8");
}

// ============================================================================
// FANDOM WIKI PARSER
// ============================================================================

/**
 * Parse blueprints from the Fandom wiki HTML
 * Tries multiple strategies to find blueprint data
 */
function parseFandomHtml(html) {
  const blueprints = [];
  const seenNames = new Set();

  console.log("\n🔍 Parsing Fandom wiki page...");

  // -------------------------------------------------------------------------
  // STRATEGY 1: Parse tables with class "wikitable" or "article-table"
  // -------------------------------------------------------------------------
  const tableRegex = /<table[^>]*class="[^"]*(?:wikitable|article-table|fandom-table)[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  let tableCount = 0;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tableCount++;
    const tableHtml = tableMatch[1];

    // Parse rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];

      // Skip header rows
      if (/<th[^>]*>/i.test(rowHtml)) continue;

      // Extract name from link or cell text
      let name = null;

      // Try to get name from link with title attribute
      const linkWithTitle = rowHtml.match(/<a[^>]*title="([^"]+)"[^>]*>/i);
      if (linkWithTitle) {
        name = linkWithTitle[1].trim();
      }

      // Or from link text content
      if (!name) {
        const linkText = rowHtml.match(/<a[^>]*>([^<]+)<\/a>/i);
        if (linkText) {
          name = linkText[1].trim();
        }
      }

      // Or from td text
      if (!name) {
        const cellText = rowHtml.match(/<td[^>]*>([^<]+)<\/td>/i);
        if (cellText) {
          name = cellText[1].trim();
        }
      }

      // Skip invalid names
      if (!name || name.length < 2) continue;
      if (name.includes("Category:") || name.includes("Template:")) continue;
      if (name.includes("File:") || name.includes("Special:")) continue;

      // Check for duplicates
      const nameLower = name.toLowerCase();
      if (seenNames.has(nameLower)) continue;
      seenNames.add(nameLower);

      // Extract image
      let image = "";
      const imgMatch = rowHtml.match(/<img[^>]+>/i);
      if (imgMatch) {
        image = extractBestImageUrl(imgMatch[0]);
      }

      blueprints.push({ name, image });
    }
  }

  log.info(`Found ${tableCount} tables, extracted ${blueprints.length} blueprints`);

  // -------------------------------------------------------------------------
  // STRATEGY 2: Parse gallery items
  // -------------------------------------------------------------------------
  const galleryRegex = /<div[^>]*class="[^"]*gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let galleryMatch;
  let galleryItems = 0;

  while ((galleryMatch = galleryRegex.exec(html)) !== null) {
    const galleryHtml = galleryMatch[1];

    // Find gallery items
    const itemRegex = /<[^>]*class="[^"]*(?:gallerybox|gallery-item)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li)>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(galleryHtml)) !== null) {
      const itemHtml = itemMatch[1];

      // Get name from caption or link
      let name = null;
      const captionMatch = itemHtml.match(/<div[^>]*class="[^"]*lightbox-caption[^"]*"[^>]*>([^<]+)/i) ||
                           itemHtml.match(/<div[^>]*class="[^"]*gallerytext[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/i);
      if (captionMatch) {
        name = captionMatch[1].trim();
      }

      if (!name) {
        const linkMatch = itemHtml.match(/<a[^>]*title="([^"]+)"/i);
        if (linkMatch) {
          name = linkMatch[1].trim();
        }
      }

      if (!name || name.length < 2) continue;
      if (name.includes("File:")) continue;

      const nameLower = name.toLowerCase();
      if (seenNames.has(nameLower)) continue;
      seenNames.add(nameLower);

      // Get image
      let image = "";
      const imgMatch = itemHtml.match(/<img[^>]+>/i);
      if (imgMatch) {
        image = extractBestImageUrl(imgMatch[0]);
      }

      blueprints.push({ name, image });
      galleryItems++;
    }
  }

  if (galleryItems > 0) {
    log.info(`Found ${galleryItems} additional blueprints from galleries`);
  }

  // -------------------------------------------------------------------------
  // STRATEGY 3: Parse content lists
  // -------------------------------------------------------------------------
  const contentMatch = html.match(/<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*(?:navbox|categories)[^"]*"/i);
  const contentHtml = contentMatch ? contentMatch[1] : html;

  // Find list items with blueprint links
  const listItemRegex = /<li[^>]*>[\s\S]*?<a[^>]*href="\/wiki\/([^"#]+)"[^>]*(?:title="([^"]+)")?[^>]*>([^<]*)<\/a>/gi;
  let listMatch;
  let listItems = 0;

  while ((listMatch = listItemRegex.exec(contentHtml)) !== null) {
    const pagePath = decodeURIComponent(listMatch[1]);
    const title = listMatch[2] || listMatch[3] || pagePath.replace(/_/g, " ");
    const name = title.trim();

    if (!name || name.length < 2) continue;
    if (name.includes("Category:") || name.includes("Template:")) continue;
    if (name.includes("File:") || name.includes("Special:")) continue;
    if (name.includes("Blueprints")) continue; // Skip self-reference

    const nameLower = name.toLowerCase();
    if (seenNames.has(nameLower)) continue;
    seenNames.add(nameLower);

    blueprints.push({ name, image: "" });
    listItems++;
  }

  if (listItems > 0) {
    log.info(`Found ${listItems} additional blueprints from lists`);
  }

  // -------------------------------------------------------------------------
  // STRATEGY 4: Try to find images for blueprints without them
  // -------------------------------------------------------------------------
  if (blueprints.some((b) => !b.image)) {
    // Build image map from all images on page
    const imageMap = new Map();
    const allImgRegex = /<img[^>]*alt="([^"]*)"[^>]*>/gi;
    let imgMatch;

    while ((imgMatch = allImgRegex.exec(html)) !== null) {
      const alt = imgMatch[1].replace(/\s+icon$/i, "").trim();
      const url = extractBestImageUrl(imgMatch[0]);
      if (alt && url) {
        imageMap.set(alt.toLowerCase(), url);
      }
    }

    // Match images to blueprints
    let matched = 0;
    for (const bp of blueprints) {
      if (!bp.image) {
        const imgUrl = imageMap.get(bp.name.toLowerCase());
        if (imgUrl) {
          bp.image = imgUrl;
          matched++;
        }
      }
    }

    if (matched > 0) {
      log.info(`Matched ${matched} images by name`);
    }
  }

  return blueprints;
}

// ============================================================================
// MAIN IMPORT LOGIC
// ============================================================================

async function importBlueprints() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         ARC Raiders Blueprint Importer                       ║");
  console.log("║         Source: arc-raiders.fandom.com                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Ensure content directory exists
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    log.success(`Created directory: ${CONTENT_DIR}`);
  }

  // Fetch the Fandom page
  let html;
  try {
    html = await fetchHtml(FANDOM_URL);
  } catch (error) {
    log.error(`Failed to fetch Fandom page: ${error.message}`);
    console.log("\n❌ Could not fetch the wiki page.");
    console.log("   Check your internet connection or try again later.");
    process.exit(1);
  }

  // Parse blueprints
  let blueprints = parseFandomHtml(html);

  if (blueprints.length === 0) {
    log.error("Could not find blueprint table — update selector.");
    console.log("\n❌ No blueprints found!");
    console.log("   The Fandom wiki layout may have changed.");
    console.log("   Please update the parser in scripts/import-blueprints.mjs");
    process.exit(1);
  }

  log.success(`Total blueprints found: ${blueprints.length}`);

  // Sort alphabetically by name
  blueprints.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  // Generate slugs and handle duplicates
  const slugCounts = new Map();
  blueprints = blueprints.map((bp) => {
    let slug = generateSlug(bp.name);
    if (!slug) slug = "blueprint";

    const count = slugCounts.get(slug) || 0;
    slugCounts.set(slug, count + 1);

    if (count > 0) {
      slug = `${slug}-${count + 1}`;
    }

    return { ...bp, slug };
  });

  // Process blueprints
  console.log("\n📝 Writing blueprint files...\n");

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i];
    const id = generateId(i);

    // Check for existing file
    const existing = readExistingBlueprint(bp.slug);

    // Build blueprint object
    // PRESERVE existing owned, ownedQty, type, and notes
    const existingOwned = existing?.owned ?? false;
    const existingOwnedQty = existing?.ownedQty ?? 0;
    const existingType = existing?.type ?? "Utility";

    const blueprint = {
      id,
      name: bp.name,
      slug: bp.slug,
      image: bp.image || "",
      type: existingType,
      owned: existingOwned,
      ownedQty: existingOwned ? Math.max(1, existingOwnedQty) : 0,
      notes: existing?.notes ?? "",
    };

    if (existing) {
      // Check if anything changed
      const changed =
        existing.id !== blueprint.id ||
        existing.name !== blueprint.name ||
        existing.image !== blueprint.image ||
        existing.slug !== blueprint.slug;

      if (changed) {
        writeBlueprint(blueprint);
        updated++;
        log.updated(`${bp.name} (${bp.slug})`);
      } else {
        unchanged++;
      }
    } else {
      writeBlueprint(blueprint);
      created++;
      log.created(`${bp.name} (${bp.slug})`);
    }
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                     Import Complete                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`
  📊 Summary:
     Total blueprints: ${blueprints.length}
     Created:          ${created}
     Updated:          ${updated}
     Unchanged:        ${unchanged}

  📁 Output directory: ${CONTENT_DIR}
`);

  // Sample entries
  console.log("  📋 Sample entries:");
  blueprints.slice(0, 5).forEach((bp, i) => {
    const hasImage = bp.image ? "✓" : "○";
    console.log(`     ${generateId(i)} ${bp.name} [img: ${hasImage}]`);
  });
  if (blueprints.length > 5) {
    console.log(`     ... and ${blueprints.length - 5} more`);
  }

  // Stats on images
  const withImages = blueprints.filter((b) => b.image).length;
  const withoutImages = blueprints.length - withImages;
  console.log(`
  🖼️  Images:
     With image:    ${withImages}
     Without image: ${withoutImages}
`);

  console.log("  📌 Next steps:");
  console.log("     1. Review files in content/blueprints/");
  console.log("     2. Set owned=true for blueprints you have");
  console.log("     3. Run: npm run dev");
  console.log("     4. Or use /admin CMS after deployment\n");
}

// Run the import
importBlueprints().catch((error) => {
  console.error("\n❌ Import failed:", error);
  process.exit(1);
});
