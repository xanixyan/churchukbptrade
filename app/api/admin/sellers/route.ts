import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import {
  getAllSellers,
  createSeller,
  getSellerById,
  updateSellerStatus,
  updateSellerTelegramChatId,
  updateSellerDiscordId,
  deleteSeller,
  updateSellerInventoryBulk,
  getSellerInventory,
} from "@/lib/sellers";
import { getAllBlueprints } from "@/lib/blueprints";
import { isValidSellerStatus, SellerStatus } from "@/lib/types";

/**
 * GET /api/admin/sellers - List all sellers
 */
export async function GET() {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sellers = getAllSellers();

    // Add inventory count to each seller
    const sellersWithStats = sellers.map((seller) => ({
      id: seller.id,
      discordId: seller.discordId,
      status: seller.status,
      telegramChatId: seller.telegramChatId,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
      inventoryCount: seller.inventory.filter((i) => i.quantity > 0).length,
      totalItems: seller.inventory.reduce((sum, i) => sum + i.quantity, 0),
    }));

    return NextResponse.json({ sellers: sellersWithStats });
  } catch (error) {
    console.error("Error fetching sellers:", error);
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sellers - Create new seller
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { discordId } = body;

    if (!discordId || typeof discordId !== "string") {
      return NextResponse.json(
        { error: "Discord ID is required" },
        { status: 400 }
      );
    }

    const trimmedDiscordId = discordId.trim();
    if (trimmedDiscordId.length === 0) {
      return NextResponse.json(
        { error: "Discord ID cannot be empty" },
        { status: 400 }
      );
    }

    // Create seller (defaults to inactive)
    const seller = createSeller(trimmedDiscordId);

    return NextResponse.json({
      success: true,
      seller: {
        id: seller.id,
        discordId: seller.discordId,
        status: seller.status,
        createdAt: seller.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create seller";
    console.error("Error creating seller:", error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

/**
 * PUT /api/admin/sellers - Update seller
 */
export async function PUT(request: NextRequest) {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sellerId, action, value } = body;

    if (!sellerId || typeof sellerId !== "string") {
      return NextResponse.json(
        { error: "Seller ID is required" },
        { status: 400 }
      );
    }

    // Check if seller exists
    const seller = getSellerById(sellerId);
    if (!seller) {
      return NextResponse.json(
        { error: "Seller not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "updateStatus": {
        if (!isValidSellerStatus(value)) {
          return NextResponse.json(
            { error: "Invalid status" },
            { status: 400 }
          );
        }
        const updated = updateSellerStatus(sellerId, value as SellerStatus);
        return NextResponse.json({
          success: true,
          seller: updated,
        });
      }

      case "updateTelegramChatId": {
        const telegramChatId = typeof value === "string" ? value.trim() : undefined;
        const updated = updateSellerTelegramChatId(sellerId, telegramChatId || undefined);
        return NextResponse.json({
          success: true,
          seller: updated,
        });
      }

      case "updateDiscordId": {
        if (!value || typeof value !== "string" || value.trim().length === 0) {
          return NextResponse.json(
            { error: "Discord ID is required" },
            { status: 400 }
          );
        }
        try {
          const updated = updateSellerDiscordId(sellerId, value.trim());
          return NextResponse.json({
            success: true,
            seller: updated,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update Discord ID";
          return NextResponse.json(
            { error: message },
            { status: 400 }
          );
        }
      }

      case "updateInventory": {
        // Admin can override seller inventory
        if (!Array.isArray(value)) {
          return NextResponse.json(
            { error: "Inventory updates must be an array" },
            { status: 400 }
          );
        }

        const updates = value as { blueprintId: string; quantity: number }[];
        const success = updateSellerInventoryBulk(sellerId, updates);

        if (!success) {
          return NextResponse.json(
            { error: "Failed to update inventory" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: `Updated ${updates.length} inventory item(s)`,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating seller:", error);
    return NextResponse.json(
      { error: "Failed to update seller" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sellers - Delete seller
 */
export async function DELETE(request: NextRequest) {
  try {
    const isAuthenticated = await validateAdminSession();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("id");

    if (!sellerId) {
      return NextResponse.json(
        { error: "Seller ID is required" },
        { status: 400 }
      );
    }

    const success = deleteSeller(sellerId);
    if (!success) {
      return NextResponse.json(
        { error: "Seller not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting seller:", error);
    return NextResponse.json(
      { error: "Failed to delete seller" },
      { status: 500 }
    );
  }
}
