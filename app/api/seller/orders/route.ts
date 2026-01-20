import { NextRequest, NextResponse } from "next/server";
import { validateSellerSession } from "@/lib/auth";
import {
  getOrdersForSeller,
  getOrderForSeller,
  getArchivedOrdersForSeller,
  getSellerOrderStats,
} from "@/lib/orders";
import { canSellerReceiveOrders } from "@/lib/types";

/**
 * GET /api/seller/orders
 * Get orders for the authenticated seller
 *
 * Query params:
 * - orderId: Optional, get specific order details
 * - archived: Optional, if "true" returns archived orders
 * - stats: Optional, if "true" returns order statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const sessionResult = await validateSellerSession();
    if (!sessionResult.valid || !sessionResult.seller) {
      return NextResponse.json(
        { success: false, error: "Не авторизовано" },
        { status: 401 }
      );
    }

    const seller = sessionResult.seller;

    if (!canSellerReceiveOrders(seller)) {
      return NextResponse.json(
        { success: false, error: "Обліковий запис неактивний" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const archived = searchParams.get("archived") === "true";
    const stats = searchParams.get("stats") === "true";

    // Return order statistics
    if (stats) {
      const orderStats = getSellerOrderStats(seller.id);
      return NextResponse.json({
        success: true,
        stats: orderStats,
      });
    }

    // Get specific order
    if (orderId) {
      const order = getOrderForSeller(orderId, seller.id);
      if (!order) {
        return NextResponse.json(
          { success: false, error: "Замовлення не знайдено" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // Get archived orders
    if (archived) {
      const orders = getArchivedOrdersForSeller(seller.id);
      return NextResponse.json({
        success: true,
        orders,
        count: orders.length,
      });
    }

    // Get active orders
    const orders = getOrdersForSeller(seller.id);

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Seller orders API error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
