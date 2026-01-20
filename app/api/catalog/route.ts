import { NextResponse } from "next/server";
import { getAllBlueprintsWithInventory } from "@/lib/blueprints";

/**
 * GET /api/catalog - Get all blueprints with aggregated inventory
 * This is the public API for the catalog page
 */
export async function GET() {
  try {
    const blueprints = getAllBlueprintsWithInventory();

    return NextResponse.json({
      blueprints,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching catalog:", error);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Failed to fetch catalog",
        error_code: "CATALOG_FETCH_ERROR",
        ...(isDev && {
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500 }
    );
  }
}

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";
