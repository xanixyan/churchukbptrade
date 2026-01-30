import { NextRequest, NextResponse } from "next/server";
import { getPublicSellerProfile } from "@/lib/sellers";
import { getPublicSellerOrderStats } from "@/lib/orders";
import { getAllBlueprints } from "@/lib/blueprints";

/**
 * GET /api/sellers/:sellerId
 * Returns public seller profile with inventory and order stats.
 *
 * Response: {
 *   seller: { id, discordId, status, createdAt },
 *   inventory: [{ blueprintId, blueprintName, blueprintSlug, blueprintImage, blueprintType, quantity, price }],
 *   stats: { totalOrders, completedOrders }
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    const { sellerId } = await params;

    if (!sellerId || typeof sellerId !== "string") {
      return NextResponse.json(
        { error: "Невірний ID продавця" },
        { status: 400 }
      );
    }

    // Get public seller profile (returns null if not found or not active)
    const sellerProfile = getPublicSellerProfile(sellerId);

    if (!sellerProfile) {
      return NextResponse.json(
        { error: "Продавця не знайдено" },
        { status: 404 }
      );
    }

    // Get order statistics
    const stats = getPublicSellerOrderStats(sellerProfile.id);

    // Get all blueprints to enrich inventory data
    const allBlueprints = getAllBlueprints();
    const blueprintMap = new Map(allBlueprints.map((bp) => [bp.id, bp]));

    // Enrich inventory with blueprint details
    const enrichedInventory = sellerProfile.inventory
      .map((item) => {
        const blueprint = blueprintMap.get(item.blueprintId);
        if (!blueprint) {
          return null; // Skip items with unknown blueprints
        }
        return {
          blueprintId: item.blueprintId,
          blueprintName: blueprint.name,
          blueprintSlug: blueprint.slug,
          blueprintImage: blueprint.image,
          blueprintType: blueprint.type,
          quantity: item.quantity,
          price: item.price,
          publicNote: item.publicNote || null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.blueprintName.localeCompare(b.blueprintName));

    return NextResponse.json({
      seller: {
        id: sellerProfile.id,
        discordId: sellerProfile.discordId,
        status: sellerProfile.status,
        createdAt: sellerProfile.createdAt,
      },
      inventory: enrichedInventory,
      stats,
    });
  } catch (error) {
    console.error("Error fetching seller profile:", error);
    return NextResponse.json(
      { error: "Помилка сервера" },
      { status: 500 }
    );
  }
}
