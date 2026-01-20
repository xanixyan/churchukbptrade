import { NextRequest, NextResponse } from "next/server";
import { validateSellerSession } from "@/lib/auth";
import { getAllBlueprints } from "@/lib/blueprints";
import {
  getSellerInventory,
  updateSellerInventoryBulk,
} from "@/lib/sellers";
import { canSellerModifyInventory } from "@/lib/types";

/**
 * GET /api/seller/inventory - Get seller's inventory with blueprint data
 */
export async function GET() {
  try {
    const sessionResult = await validateSellerSession();

    if (!sessionResult.valid || !sessionResult.seller) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const seller = sessionResult.seller;

    // Get all blueprints (catalog)
    const blueprints = getAllBlueprints();

    // Get seller's inventory
    const inventory = getSellerInventory(seller.id);

    // Create inventory map for quick lookup
    const inventoryMap = new Map(
      inventory.map((item) => [item.blueprintId, item.quantity])
    );

    // Combine blueprints with seller's quantities
    const blueprintsWithInventory = blueprints.map((bp) => ({
      id: bp.id,
      name: bp.name,
      slug: bp.slug,
      image: bp.image,
      type: bp.type,
      quantity: inventoryMap.get(bp.id) || 0,
    }));

    return NextResponse.json({
      seller: {
        id: seller.id,
        discordId: seller.discordId,
        status: seller.status,
      },
      blueprints: blueprintsWithInventory,
    });
  } catch (error) {
    console.error("Error fetching seller inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/seller/inventory - Update seller's inventory (quantity only)
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionResult = await validateSellerSession();

    if (!sessionResult.valid || !sessionResult.seller) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const seller = sessionResult.seller;

    // Check if seller can modify inventory
    if (!canSellerModifyInventory(seller)) {
      return NextResponse.json(
        { error: "You do not have permission to modify inventory" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updates } = body as {
      updates: { blueprintId: string; quantity: number }[];
    };

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      );
    }

    // Validate updates - sellers can only change quantities
    const validUpdates: { blueprintId: string; quantity: number }[] = [];
    const allBlueprints = getAllBlueprints();
    const blueprintIds = new Set(allBlueprints.map((bp) => bp.id));

    for (const update of updates) {
      if (!update.blueprintId || typeof update.blueprintId !== "string") {
        continue;
      }

      // Verify blueprint exists
      if (!blueprintIds.has(update.blueprintId)) {
        continue;
      }

      // Validate quantity
      const qty = Math.max(0, Math.floor(update.quantity || 0));
      validUpdates.push({ blueprintId: update.blueprintId, quantity: qty });
    }

    // Apply updates
    const success = updateSellerInventoryBulk(seller.id, validUpdates);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update inventory" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${validUpdates.length} item(s)`,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating seller inventory:", error);
    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 }
    );
  }
}
