import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import { getSellerById, getSellerInventory, updateSellerInventoryBulk } from "@/lib/sellers";
import { getAllBlueprints } from "@/lib/blueprints";

/**
 * GET /api/admin/sellers/[id]/inventory - Get seller's full inventory
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: sellerId } = await params;

    const seller = getSellerById(sellerId);
    if (!seller) {
      return NextResponse.json(
        { error: "Seller not found" },
        { status: 404 }
      );
    }

    // Get all blueprints
    const blueprints = getAllBlueprints();

    // Get seller's inventory
    const inventory = getSellerInventory(sellerId);
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
        telegramChatId: seller.telegramChatId,
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
 * PUT /api/admin/sellers/[id]/inventory - Update seller's inventory (admin override)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: sellerId } = await params;

    const seller = getSellerById(sellerId);
    if (!seller) {
      return NextResponse.json(
        { error: "Seller not found" },
        { status: 404 }
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

    // Validate updates
    const allBlueprints = getAllBlueprints();
    const blueprintIds = new Set(allBlueprints.map((bp) => bp.id));

    const validUpdates: { blueprintId: string; quantity: number }[] = [];
    for (const update of updates) {
      if (!update.blueprintId || typeof update.blueprintId !== "string") {
        continue;
      }
      if (!blueprintIds.has(update.blueprintId)) {
        continue;
      }
      const qty = Math.max(0, Math.floor(update.quantity || 0));
      validUpdates.push({ blueprintId: update.blueprintId, quantity: qty });
    }

    const success = updateSellerInventoryBulk(sellerId, validUpdates);
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
