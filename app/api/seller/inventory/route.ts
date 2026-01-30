import { NextRequest, NextResponse } from "next/server";
import { validateSellerSession } from "@/lib/auth";

// Force dynamic — never cache seller-specific inventory data
export const dynamic = "force-dynamic";
import { getAllBlueprints } from "@/lib/blueprints";
import {
  getSellerInventory,
  updateSellerInventoryBulkWithPrice,
} from "@/lib/sellers";
import {
  canSellerModifyInventory,
  validateItemPrice,
  normalizeItemPrice,
  ItemPrice,
  PRICE_TYPES,
  PRICE_AMOUNT_MIN,
  PRICE_AMOUNT_MAX,
  TRADE_BLUEPRINTS_MAX,
  OTHER_LABEL_MAX_LENGTH,
} from "@/lib/types";

/**
 * GET /api/seller/inventory - Get seller's inventory with blueprint data and prices
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

    // Create inventory map for quick lookup (quantity, price, publicNote)
    const inventoryMap = new Map(
      inventory.map((item) => [
        item.blueprintId,
        {
          quantity: item.quantity,
          price: normalizeItemPrice(item.price),
          publicNote: item.publicNote || null,
        }
      ])
    );

    // Combine blueprints with seller's quantities, prices, and public notes
    const blueprintsWithInventory = blueprints.map((bp) => {
      const inv = inventoryMap.get(bp.id);
      return {
        id: bp.id,
        name: bp.name,
        slug: bp.slug,
        image: bp.image,
        type: bp.type,
        quantity: inv?.quantity || 0,
        price: inv?.price || { type: "Договірна" as const },
        publicNote: inv?.publicNote || null,
      };
    });

    return NextResponse.json({
      seller: {
        id: seller.id,
        discordId: seller.discordId,
        status: seller.status,
      },
      blueprints: blueprintsWithInventory,
      // Provide the full list of blueprints for trade price selection
      catalogBlueprints: blueprints.map((bp) => ({
        id: bp.id,
        name: bp.name,
      })),
      priceConfig: {
        types: PRICE_TYPES,
        amountMin: PRICE_AMOUNT_MIN,
        amountMax: PRICE_AMOUNT_MAX,
        tradeBlueprintsMax: TRADE_BLUEPRINTS_MAX,
        otherLabelMaxLength: OTHER_LABEL_MAX_LENGTH,
      },
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
 * PUT /api/seller/inventory - Update seller's inventory (quantity and price)
 *
 * Body format:
 * {
 *   updates: [
 *     {
 *       blueprintId: string,
 *       quantity: number,
 *       price?: ItemPrice  // New price object structure
 *     }
 *   ]
 * }
 *
 * Price object structure:
 * {
 *   type: "Договірна" | "Пружини" | "Насіння" | "Качки" | "Інші матеріали" | "Блюпринт(-и)",
 *   amount?: number,           // Required for material types
 *   otherLabel?: string,       // Required for "Інші матеріали"
 *   tradeBlueprints?: Array<{  // Required for "Блюпринт(-и)"
 *     blueprintId: string,
 *     name?: string,
 *     qty: number
 *   }>
 * }
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
      updates: { blueprintId: string; quantity: number; price?: ItemPrice | unknown }[];
    };

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      );
    }

    // Get all blueprints for validation
    const allBlueprints = getAllBlueprints();
    const blueprintIds = new Set(allBlueprints.map((bp) => bp.id));

    // Validate updates
    const validUpdates: { blueprintId: string; quantity: number; price?: ItemPrice }[] = [];

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

      // Validate price if provided
      let price: ItemPrice | undefined = undefined;

      if (update.price !== undefined) {
        // Validate the price object
        const priceValidation = validateItemPrice(update.price, blueprintIds);
        if (!priceValidation.valid) {
          return NextResponse.json(
            { error: `${update.blueprintId}: ${priceValidation.error}` },
            { status: 400 }
          );
        }
        price = normalizeItemPrice(update.price);
      }

      validUpdates.push({ blueprintId: update.blueprintId, quantity: qty, price });
    }

    // Apply updates with price support
    const result = await updateSellerInventoryBulkWithPrice(seller.id, validUpdates, blueprintIds);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update inventory" },
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
