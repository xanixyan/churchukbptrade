import { NextRequest, NextResponse } from "next/server";
import { getBlueprintById } from "@/lib/blueprints";
import { getSellerListingsWithQueue } from "@/lib/sellers";

/**
 * GET /api/blueprints/[id]/sellers - Get all sellers who have this blueprint in stock
 *
 * Returns sellers sorted by sellerId for fair round-robin ordering.
 * Includes recommended seller (next in queue) for fair distribution.
 *
 * Response format:
 * {
 *   blueprintId: string,
 *   blueprintName: string,
 *   blueprintSlug: string,
 *   blueprintImage: string,
 *   recommendedSeller: SellerListing | null,  // Next seller in round-robin queue
 *   sellers: [
 *     {
 *       sellerId: string,
 *       sellerDiscordId: string,
 *       quantity: number,
 *       price: ItemPrice  // Full price object
 *     }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: blueprintId } = await params;

    if (!blueprintId) {
      return NextResponse.json(
        { error: "Blueprint ID is required" },
        { status: 400 }
      );
    }

    // Verify blueprint exists
    const blueprint = getBlueprintById(blueprintId);
    if (!blueprint) {
      return NextResponse.json(
        { error: "Blueprint not found" },
        { status: 404 }
      );
    }

    // Get seller listings with queue recommendation
    const response = await getSellerListingsWithQueue(
      blueprintId,
      blueprint.name,
      blueprint.slug,
      blueprint.image
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching sellers for blueprint:", error);
    return NextResponse.json(
      { error: "Failed to fetch sellers" },
      { status: 500 }
    );
  }
}
