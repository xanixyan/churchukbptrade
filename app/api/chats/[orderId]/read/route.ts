import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { authorizeChatAccess, markChatRead } from "@/lib/chats";

type RouteParams = { params: Promise<{ orderId: string }> };

/**
 * POST /api/chats/[orderId]/read - Mark chat as read for the current user.
 */
export async function POST(
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
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "Доступ заборонено" },
        { status: 403 }
      );
    }

    await markChatRead(orderId, session.role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat mark-read error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
