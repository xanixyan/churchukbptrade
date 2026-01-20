import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { validateAdminSession } from "@/lib/auth";
import { safeWriteJson, safeReadJson } from "@/lib/safe-file";
import { Blueprint, isValidBlueprintType, normalizeOwnedQty } from "@/lib/types";

const BLUEPRINTS_DIR = path.join(process.cwd(), "content", "blueprints");

// Logging helper
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[ADMIN API ${timestamp}] ${message}`, data !== undefined ? JSON.stringify(data) : "");
}

interface BlueprintUpdate {
  slug: string;
  owned: boolean;
  ownedQty: number;
}

interface BlueprintWithMeta extends Blueprint {
  updatedAt?: string;
}

/**
 * GET /api/admin/blueprints - List all blueprints
 */
export async function GET() {
  try {
    // Verify admin session
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Read all blueprint files
    if (!fs.existsSync(BLUEPRINTS_DIR)) {
      return NextResponse.json({ blueprints: [] });
    }

    const files = fs.readdirSync(BLUEPRINTS_DIR).filter((f) => f.endsWith(".json"));
    const blueprints: BlueprintWithMeta[] = [];

    for (const file of files) {
      const filePath = path.join(BLUEPRINTS_DIR, file);
      const data = safeReadJson<BlueprintWithMeta>(filePath);
      if (data && data.id && data.name && data.slug) {
        blueprints.push(data);
      }
    }

    // Sort by name
    blueprints.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ blueprints });
  } catch (error) {
    console.error("Error fetching blueprints:", error);
    return NextResponse.json(
      { error: "Failed to fetch blueprints" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/blueprints - Update blueprints
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify admin session
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      log("PUT request rejected: unauthorized");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { updates } = body as { updates: BlueprintUpdate[] };

    log("PUT request received", { updateCount: updates?.length });
    log("Blueprints directory", { path: BLUEPRINTS_DIR, exists: fs.existsSync(BLUEPRINTS_DIR) });

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      );
    }

    const results: { slug: string; success: boolean; error?: string }[] = [];
    const updatedAt = new Date().toISOString();

    for (const update of updates) {
      const { slug, owned, ownedQty } = update;

      log(`Processing update for ${slug}`, { owned, ownedQty });

      // Validate slug
      if (!slug || typeof slug !== "string") {
        results.push({ slug: slug || "unknown", success: false, error: "Invalid slug" });
        continue;
      }

      const filePath = path.join(BLUEPRINTS_DIR, `${slug}.json`);
      log(`File path for ${slug}`, { filePath, exists: fs.existsSync(filePath) });

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        log(`File not found: ${filePath}`);
        results.push({ slug, success: false, error: "Blueprint not found" });
        continue;
      }

      try {
        // Read existing data
        const existingData = safeReadJson<BlueprintWithMeta>(filePath);
        if (!existingData) {
          results.push({ slug, success: false, error: "Failed to read blueprint" });
          continue;
        }

        log(`Read existing data for ${slug}`, { owned: existingData.owned, ownedQty: existingData.ownedQty });

        // Validate and normalize values
        const newOwned = Boolean(owned);
        const newOwnedQty = normalizeOwnedQty(newOwned, ownedQty);

        // Update blueprint
        const updatedBlueprint: BlueprintWithMeta = {
          id: existingData.id,
          name: existingData.name,
          slug: existingData.slug,
          image: existingData.image,
          type: isValidBlueprintType(existingData.type) ? existingData.type : "Utility",
          owned: newOwned,
          ownedQty: newOwnedQty,
          notes: existingData.notes || "",
          updatedAt,
        };

        // Write safely
        log(`Writing updated data for ${slug}`, { owned: newOwned, ownedQty: newOwnedQty });
        safeWriteJson(filePath, updatedBlueprint);

        // Verify write by reading back
        const verifyData = safeReadJson<BlueprintWithMeta>(filePath);
        if (verifyData && verifyData.owned === newOwned && verifyData.ownedQty === newOwnedQty) {
          log(`Write verified for ${slug}`, { owned: verifyData.owned, ownedQty: verifyData.ownedQty });
          results.push({ slug, success: true });
        } else {
          log(`Write verification FAILED for ${slug}`, { expected: { owned: newOwned, ownedQty: newOwnedQty }, actual: verifyData });
          results.push({ slug, success: false, error: "Write verification failed" });
        }
      } catch (err) {
        log(`Error updating ${slug}`, { error: String(err) });
        results.push({ slug, success: false, error: "Write failed" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    log("PUT request completed", { successCount, failCount });

    return NextResponse.json({
      success: failCount === 0,
      message: `Updated ${successCount} blueprint(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
      results,
      updatedAt,
    });
  } catch (error) {
    log("PUT request error", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to update blueprints" },
      { status: 500 }
    );
  }
}
