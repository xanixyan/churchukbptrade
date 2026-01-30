import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { authorizeChatAccess, addChatMessage } from "@/lib/chats";

type RouteParams = { params: Promise<{ orderId: string }> };

/**
 * POST /api/chats/[orderId]/messages - Create a message (authorized)
 */
export async function POST(
  request: NextRequest,
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
    if (!auth.authorized || !auth.senderType || !auth.senderId || !auth.senderName) {
      return NextResponse.json(
        { success: false, error: auth.error || "Доступ заборонено" },
        { status: 403 }
      );
    }

    let body: { text?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Невірний формат даних" },
        { status: 400 }
      );
    }

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json(
        { success: false, error: "Текст повідомлення обов'язковий" },
        { status: 400 }
      );
    }

    const result = await addChatMessage(
      orderId,
      auth.senderType,
      auth.senderId,
      auth.senderName,
      body.text
    );

    if (!result.success) {
      const status = result.error?.includes("Забагато") ? 429 : 400;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Chat message error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
