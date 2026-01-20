/**
 * Fandom Wiki Scraper for ARC Raiders Blueprints
 *
 * This script attempts to fetch blueprint information from the ARC Raiders Fandom wiki.
 * It's a best-effort scraper and may break if the wiki structure changes.
 *
 * Usage: npm run scrape:fandom
 * Output: all-blueprints.json in project root
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "..", "all-blueprints.json");

const WIKI_URL = "https://arc-raiders.fandom.com/wiki/Blueprints";

async function fetchPage(url) {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

function extractBlueprints(html) {
  const blueprints = [];

  // Try to find blueprint entries in tables or lists
  // This is a simple regex-based approach that looks for common patterns

  // Pattern 1: Look for table rows with blueprint data
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];

  for (const row of rows) {
    // Extract name from links
    const nameMatch = row.match(/<a[^>]*title="([^"]+)"[^>]*>/i);
    // Extract image URL
    const imageMatch = row.match(/data-src="([^"]+)"|src="(https:\/\/static\.wikia\.nocookie\.net[^"]+)"/i);

    if (nameMatch) {
      const name = nameMatch[1].replace(/_/g, " ");
      // Skip navigation/meta entries
      if (name.includes("Category:") || name.includes("Template:") || name.includes("Special:")) {
        continue;
      }

      const imageUrl = imageMatch ? (imageMatch[1] || imageMatch[2]) : "";
      // Clean up image URL (remove scaling parameters)
      const cleanImageUrl = imageUrl ? imageUrl.split("/revision/")[0] : "";

      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      if (slug && name) {
        blueprints.push({
          id: `BP-${slug.toUpperCase().slice(0, 10)}`,
          name: name,
          slug: slug,
          image: cleanImageUrl,
          owned: false,
          notes: ""
        });
      }
    }
  }

  // Pattern 2: Look for gallery items
  const galleryRegex = /<div[^>]*class="[^"]*gallery[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  const galleries = html.match(galleryRegex) || [];

  for (const gallery of galleries) {
    const itemRegex = /<a[^>]*href="\/wiki\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>/gi;
    let match;

    while ((match = itemRegex.exec(gallery)) !== null) {
      const pageName = decodeURIComponent(match[1]).replace(/_/g, " ");
      const imageUrl = match[2];

      if (pageName.includes("Category:") || pageName.includes("Template:")) {
        continue;
      }

      const cleanImageUrl = imageUrl ? imageUrl.split("/revision/")[0] : "";
      const slug = pageName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      if (slug && !blueprints.find(bp => bp.slug === slug)) {
        blueprints.push({
          id: `BP-${slug.toUpperCase().slice(0, 10)}`,
          name: pageName,
          slug: slug,
          image: cleanImageUrl,
          owned: false,
          notes: ""
        });
      }
    }
  }

  // Pattern 3: Simple list items with links
  const listItemRegex = /<li[^>]*>[\s\S]*?<a[^>]*href="\/wiki\/([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
  let listMatch;

  while ((listMatch = listItemRegex.exec(html)) !== null) {
    const pageName = listMatch[2];

    if (pageName.includes("Category:") || pageName.includes("Template:") || pageName.includes("Special:")) {
      continue;
    }

    const slug = pageName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    if (slug && !blueprints.find(bp => bp.slug === slug)) {
      blueprints.push({
        id: `BP-${slug.toUpperCase().slice(0, 10)}`,
        name: pageName,
        slug: slug,
        image: "",
        owned: false,
        notes: ""
      });
    }
  }

  return blueprints;
}

async function main() {
  console.log("ARC Raiders Fandom Blueprint Scraper");
  console.log("=====================================\n");

  try {
    const html = await fetchPage(WIKI_URL);
    console.log(`Fetched ${html.length} bytes\n`);

    const blueprints = extractBlueprints(html);

    // Remove duplicates by slug
    const uniqueBlueprints = [];
    const seenSlugs = new Set();

    for (const bp of blueprints) {
      if (!seenSlugs.has(bp.slug)) {
        seenSlugs.add(bp.slug);
        uniqueBlueprints.push(bp);
      }
    }

    // Sort by name
    uniqueBlueprints.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${uniqueBlueprints.length} blueprints\n`);

    if (uniqueBlueprints.length === 0) {
      console.log("No blueprints found. The wiki structure may have changed.");
      console.log("You can manually add blueprints via /admin once deployed.\n");
    } else {
      // Show first few entries
      console.log("Sample entries:");
      for (const bp of uniqueBlueprints.slice(0, 5)) {
        console.log(`  - ${bp.name} (${bp.id})`);
      }
      if (uniqueBlueprints.length > 5) {
        console.log(`  ... and ${uniqueBlueprints.length - 5} more\n`);
      }
    }

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueBlueprints, null, 2));
    console.log(`\nOutput written to: ${OUTPUT_FILE}`);
    console.log("\nTo use these blueprints:");
    console.log("1. Review the generated JSON file");
    console.log("2. Mark 'owned: true' for blueprints you own");
    console.log("3. Copy individual entries to content/blueprints/<slug>.json");
    console.log("   Or use /admin to manage them after deployment\n");

  } catch (error) {
    console.error("Error scraping wiki:", error.message);
    console.log("\nThis scraper is best-effort and may fail if:");
    console.log("- The wiki is down or blocked");
    console.log("- The wiki structure has changed");
    console.log("- There are network issues\n");
    console.log("You can still add blueprints manually via /admin\n");
    process.exit(1);
  }
}

main();
