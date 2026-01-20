import { NextRequest, NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/auth";
import {
  getAllOrdersForAdmin,
  getActiveOrdersForAdmin,
  getArchivedOrdersForAdmin,
  clearAllOrders,
  closeOrder,
  cancelOrder,
} from "@/lib/orders";

/**
 * GET /api/admin/orders
 * Get orders for admin view
 * Query params:
 *   filter: "active" | "archived" | "all" (default: "all")
 */
export async function GET(request: NextRequest) {
  const isAdmin = await validateAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    let orders;
    switch (filter) {
      case "active":
        orders = getActiveOrdersForAdmin();
        break;
      case "archived":
        orders = getArchivedOrdersForAdmin();
        break;
      default:
        orders = getAllOrdersForAdmin();
    }

    return NextResponse.json({
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити замовлення" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/orders
 * Perform admin actions on orders
 * Body:
 *   action: "close" | "cancel" | "clearAll"
 *   orderId: string (required for close/cancel)
 */
export async function POST(request: NextRequest) {
  const isAdmin = await validateAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, orderId } = body;

    switch (action) {
      case "close": {
        if (!orderId) {
          return NextResponse.json({ error: "orderId обов'язковий" }, { status: 400 });
        }
        const result = await closeOrder(orderId, "admin", true);
        if (result.success) {
          return NextResponse.json({ success: true, message: "Замовлення закрито" });
        }
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case "cancel": {
        if (!orderId) {
          return NextResponse.json({ error: "orderId обов'язковий" }, { status: 400 });
        }
        const result = await cancelOrder(orderId);
        if (result.success) {
          return NextResponse.json({ success: true, message: "Замовлення скасовано" });
        }
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      case "clearAll": {
        const result = clearAllOrders();
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: `Видалено ${result.deletedCount} замовлень`,
            deletedCount: result.deletedCount,
          });
        }
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      default:
        return NextResponse.json({ error: "Невідома дія" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error performing admin order action:", error);
    return NextResponse.json(
      { error: "Помилка обробки запиту" },
      { status: 500 }
    );
  }
}
