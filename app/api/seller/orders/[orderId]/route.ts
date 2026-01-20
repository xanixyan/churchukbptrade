import { NextRequest, NextResponse } from "next/server";
import { validateSellerSession } from "@/lib/auth";
import {
  acceptOrderFull,
  claimOrderItems,
  fulfillOrderItem,
  fulfillAllClaimedItems,
  closeOrder,
  releaseOrderItem,
  getOrderForSeller,
} from "@/lib/orders";
import { canSellerReceiveOrders } from "@/lib/types";

type RouteParams = { params: Promise<{ orderId: string }> };

/**
 * GET /api/seller/orders/[orderId]
 * Get specific order details for seller
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;

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
  } catch (error) {
    console.error("Seller order GET error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seller/orders/[orderId]
 * Perform actions on an order
 *
 * Body:
 * - action: "accept" | "claim" | "fulfill" | "fulfill_all" | "close" | "release"
 * - blueprintId: Optional, required for "fulfill" and "release" actions
 * - blueprintIds: Optional, for "claim" action to claim specific items
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;

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

    // Parse request body
    let body: {
      action: string;
      blueprintId?: string;
      blueprintIds?: string[];
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Невірний формат даних" },
        { status: 400 }
      );
    }

    const { action, blueprintId, blueprintIds } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Дія не вказана" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "accept":
        // Full order acceptance
        result = await acceptOrderFull(orderId, seller.id);
        break;

      case "claim":
        // Partial claim (specific items or all claimable)
        result = await claimOrderItems(orderId, seller.id, blueprintIds);
        break;

      case "fulfill":
        // Fulfill specific item
        if (!blueprintId) {
          return NextResponse.json(
            { success: false, error: "blueprintId обов'язковий для виконання" },
            { status: 400 }
          );
        }
        result = await fulfillOrderItem(orderId, seller.id, blueprintId);
        break;

      case "fulfill_all":
        // Fulfill all claimed items
        result = await fulfillAllClaimedItems(orderId, seller.id);
        break;

      case "close":
        // Close order
        result = await closeOrder(orderId, seller.id, false);
        break;

      case "release":
        // Release claim on item
        if (!blueprintId) {
          return NextResponse.json(
            { success: false, error: "blueprintId обов'язковий для скасування" },
            { status: 400 }
          );
        }
        result = await releaseOrderItem(orderId, seller.id, blueprintId);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Невідома дія: ${action}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get updated order view
    const updatedOrder = getOrderForSeller(orderId, seller.id);

    return NextResponse.json({
      success: true,
      message: getSuccessMessage(action),
      claimedItems: result.claimedItems,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Seller order action error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}

function getSuccessMessage(action: string): string {
  switch (action) {
    case "accept":
      return "Замовлення прийнято";
    case "claim":
      return "Позиції прийняті";
    case "fulfill":
      return "Позицію виконано";
    case "fulfill_all":
      return "Всі позиції виконано";
    case "close":
      return "Замовлення закрито";
    case "release":
      return "Позицію скасовано";
    default:
      return "Операція виконана";
  }
}
