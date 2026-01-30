import { NextRequest, NextResponse } from "next/server";
import { validateSellerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
import { updateSellerPublicNote } from "@/lib/sellers";
import { canSellerModifyInventory, SELLER_PUBLIC_NOTE_MAX_LENGTH } from "@/lib/types";

type RouteParams = { params: Promise<{ itemId: string }> };

/**
 * PATCH /api/seller/inventory/[itemId]/comment
 * Update the public note for a seller's inventory item.
 * Body: { publicNote: string | null }
 *
 * Also accepts legacy { comment: string | null } for backward compatibility.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { itemId } = await params;

    const sessionResult = await validateSellerSession();
    if (!sessionResult.valid || !sessionResult.seller) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const seller = sessionResult.seller;

    if (!canSellerModifyInventory(seller)) {
      return NextResponse.json(
        { error: "Немає дозволу на зміну інвентарю" },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Accept both `publicNote` and legacy `comment`
    const publicNote: string | null = body.publicNote !== undefined ? body.publicNote : (body.comment ?? null);

    // Validate type
    if (publicNote !== null && typeof publicNote !== "string") {
      return NextResponse.json(
        { error: "Невірний формат нотатки" },
        { status: 400 }
      );
    }

    // Validate length before processing
    if (publicNote !== null && publicNote.length > SELLER_PUBLIC_NOTE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Нотатка занадто довга (макс. ${SELLER_PUBLIC_NOTE_MAX_LENGTH} символів)` },
        { status: 400 }
      );
    }

    const result = await updateSellerPublicNote(seller.id, itemId, publicNote);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Помилка збереження нотатки" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating seller public note:", error);
    return NextResponse.json(
      { error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }
}
