import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { listChatsForUser } from "@/lib/chats";

/**
 * GET /api/chats - List chats for the current user (role-aware).
 * Returns { chats, totalUnread } where totalUnread is the sum of
 * unread messages across all chats for this user.
 */
export async function GET() {
  try {
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

    const result = listChatsForUser(session.role, session.userId, session.discordId);

    return NextResponse.json({
      success: true,
      chats: result.chats,
      totalUnread: result.totalUnread,
    });
  } catch (error) {
    console.error("Chat list error:", error);
    return NextResponse.json(
      { success: false, error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
