import { NextRequest } from "next/server";
import { validateSession } from "@/lib/auth";
import { authorizeChatAccess, subscribeToChatUpdates, ChatMessage } from "@/lib/chats";

type RouteParams = { params: Promise<{ orderId: string }> };

/**
 * GET /api/chats/[orderId]/stream - SSE live updates stream (authorized)
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const { orderId } = await params;

  const session = await validateSession();
  if (!session.authenticated || !session.role || !session.userId || !session.discordId) {
    return new Response(JSON.stringify({ success: false, error: "Не авторизовано" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (session.role !== "buyer" && session.role !== "seller") {
    return new Response(JSON.stringify({ success: false, error: "Доступ заборонено" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = authorizeChatAccess(orderId, session.role, session.userId, session.discordId);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ success: false, error: auth.error || "Доступ заборонено" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to chat updates
      unsubscribe = subscribeToChatUpdates(orderId, (message: ChatMessage) => {
        if (closed) return;
        try {
          if (message.text === "__CHAT_CLOSED__") {
            controller.enqueue(encoder.encode(`event: chat_closed\ndata: {}\n\n`));
            closed = true;
            controller.close();
            return;
          }
          const data = JSON.stringify(message);
          controller.enqueue(encoder.encode(`event: message\ndata: ${data}\n\n`));
        } catch {
          // Stream may be closed
        }
      });

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        if (closed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30_000);

      // Clean up on abort
      _request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(keepalive);
        if (unsubscribe) unsubscribe();
      });
    },
    cancel() {
      closed = true;
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
