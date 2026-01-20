import { NextResponse } from "next/server";
import { validateBuyerSession } from "@/lib/auth";
import { getOrdersForBuyer, getActiveOrdersForBuyer, getArchivedOrdersForBuyer } from "@/lib/orders";

/**
 * GET /api/buyer/orders - Get orders for the current buyer
 * Query params:
 * - filter: "all" | "active" | "archived" (default: "all")
 */
export async function GET(request: Request) {
  try {
    const sessionResult = await validateBuyerSession();

    if (!sessionResult.valid || !sessionResult.buyer) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const buyer = sessionResult.buyer;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    let orders;
    switch (filter) {
      case "active":
        orders = getActiveOrdersForBuyer(buyer.discordId);
        break;
      case "archived":
        orders = getArchivedOrdersForBuyer(buyer.discordId);
        break;
      default:
        orders = getOrdersForBuyer(buyer.discordId);
    }

    return NextResponse.json({
      orders,
      buyer: {
        id: buyer.id,
        discordId: buyer.discordId,
      },
    });
  } catch (error) {
    console.error("Error fetching buyer orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
