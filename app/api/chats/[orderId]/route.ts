import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { authorizeChatAccess, getOrCreateChat } from "@/lib/chats";

type RouteParams = { params: Promise<{ orderId: string }> };

/**
 * GET /api/chats/[orderId] - Fetch messages for an order chat (authorized)
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;

    const session = await validateSession();
    if (!session.authenticated || !session.role || !session.userId || !session.discordId) {
      return NextResponse.json(
        { success: false, error: "Не авторизовано" },
        { status: 401 }
      );
    }

    if (session.role !== "buyer" && session.role !== "seller") {
      return NextResponse.json(
        { success: false, error: "Доступ заборонено" },
        { status: 403 }
      );
    }

    const auth = authorizeChatAccess(orderId, session.role, session.userId, session.discordId);
    if (!auth.authorized || !auth.order) {
      return NextResponse.json(
        { success: false, error: auth.error || "Доступ заборонено" },
        { status: 403 }
      );
    }

    const chat = getOrCreateChat(auth.order);
    if (!chat) {
      return NextResponse.json(
        { success: false, error: "Чат недоступний для цього замовлення" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: chat.orderId,
      messages: chat.messages,
      buyerDiscordId: chat.buyerDiscordId,
      sellerDiscordId: chat.sellerDiscordId,
    });
  } catch (error) {
    console.error("Chat fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
