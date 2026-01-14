// Order types and validation

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface OrderRequest {
  discordNick: string;
  offer: string;
  notes?: string;
  items: OrderItem[];
  // Honeypot field - should be empty
  website?: string;
}

export interface OrderValidationError {
  field: string;
  message: string;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: OrderValidationError[];
}

/**
 * Validate order request
 */
export function validateOrder(data: unknown): OrderValidationResult {
  const errors: OrderValidationError[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Невалідний запит" }] };
  }

  const order = data as Record<string, unknown>;

  // Check honeypot (anti-bot)
  if (order.website && typeof order.website === "string" && order.website.trim() !== "") {
    return { valid: false, errors: [{ field: "spam", message: "Запит відхилено" }] };
  }

  // Discord nickname validation
  if (!order.discordNick || typeof order.discordNick !== "string") {
    errors.push({ field: "discordNick", message: "Введіть Discord нікнейм" });
  } else {
    const nick = order.discordNick.trim();
    if (nick.length === 0) {
      errors.push({ field: "discordNick", message: "Введіть Discord нікнейм" });
    } else if (nick.length > 64) {
      errors.push({ field: "discordNick", message: "Discord нікнейм занадто довгий (макс. 64 символи)" });
    }
  }

  // Offer validation (required)
  if (!order.offer || typeof order.offer !== "string") {
    errors.push({ field: "offer", message: "Введіть що пропонуєте взамін" });
  } else {
    const offer = order.offer.trim();
    if (offer.length === 0) {
      errors.push({ field: "offer", message: "Введіть що пропонуєте взамін" });
    } else if (offer.length > 500) {
      errors.push({ field: "offer", message: "Текст пропозиції занадто довгий (макс. 500 символів)" });
    }
  }

  // Notes validation (optional)
  if (order.notes && typeof order.notes === "string" && order.notes.length > 500) {
    errors.push({ field: "notes", message: "Нотатки занадто довгі (макс. 500 символів)" });
  }

  // Items validation
  if (!order.items || !Array.isArray(order.items)) {
    errors.push({ field: "items", message: "Виберіть хоча б одне креслення" });
  } else {
    if (order.items.length === 0) {
      errors.push({ field: "items", message: "Виберіть хоча б одне креслення" });
    } else if (order.items.length > 50) {
      errors.push({ field: "items", message: "Занадто багато позицій (макс. 50)" });
    } else {
      // Validate each item
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i] as Record<string, unknown>;
        if (!item || typeof item !== "object") {
          errors.push({ field: `items[${i}]`, message: "Невалідна позиція" });
          continue;
        }
        if (!item.id || typeof item.id !== "string") {
          errors.push({ field: `items[${i}].id`, message: "Відсутній ID креслення" });
        }
        if (!item.name || typeof item.name !== "string") {
          errors.push({ field: `items[${i}].name`, message: "Відсутня назва креслення" });
        }
        if (typeof item.quantity !== "number" || item.quantity < 1 || item.quantity > 999) {
          errors.push({ field: `items[${i}].quantity`, message: "Невалідна кількість (1-999)" });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format order for Telegram message
 */
export function formatTelegramMessage(order: OrderRequest, userAgent?: string): string {
  const itemsList = order.items
    .map((item) => `  • ${item.name} (${item.id}) ×${item.quantity}`)
    .join("\n");

  const timestamp = new Date().toISOString();
  const shortUA = userAgent ? userAgent.substring(0, 100) : "Unknown";

  let message = `🆕 <b>НОВЕ ЗАМОВЛЕННЯ</b> (churchukbptrade)\n\n`;
  message += `👤 <b>Discord:</b> ${escapeHtml(order.discordNick.trim())}\n`;
  message += `💰 <b>Пропозиція:</b> ${escapeHtml(order.offer.trim())}\n`;

  if (order.notes && order.notes.trim()) {
    message += `📝 <b>Примітка:</b> ${escapeHtml(order.notes.trim())}\n`;
  }

  message += `\n📦 <b>Позиції:</b>\n${escapeHtml(itemsList)}\n`;
  message += `\n🕐 ${timestamp}\n`;
  message += `🌐 ${escapeHtml(shortUA)}`;

  return message;
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send message to Telegram
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Telegram API error:", errorData);
      return { success: false, error: "Помилка відправки повідомлення" };
    }

    return { success: true };
  } catch (error) {
    console.error("Telegram send error:", error);
    return { success: false, error: "Помилка з'єднання з Telegram" };
  }
}
