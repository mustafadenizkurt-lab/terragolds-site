import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import { parseDiscountCodeInput } from "../../../../../lib/discount-code-input";
import { getD1 } from "../../../../../lib/store-db";
import { readDiscountCodes } from "../route";

export const dynamic = "force-dynamic";

function readId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("İndirim kodu bulunamadı.");
  }
  return id;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    const input = parseDiscountCodeInput(
      (await request.json()) as Record<string, unknown>,
    );
    const result = await getD1()
      .prepare(
        `UPDATE discount_codes
         SET code = ?, description = ?, discount_type = ?,
             discount_value = ?, minimum_order_amount = ?,
             usage_limit = ?, active = ?, starts_at = ?, expires_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        input.code,
        input.description,
        input.discountType,
        input.discountValue,
        input.minimumOrderAmount,
        input.usageLimit,
        input.active ? 1 : 0,
        input.startsAt,
        input.expiresAt,
        id,
      )
      .run();
    if (!result.meta.changes) {
      return Response.json(
        { error: "İndirim kodu bulunamadı." },
        { status: 404 },
      );
    }
    return Response.json({ discountCodes: await readDiscountCodes() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "İndirim kodu güncellenemedi.";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "Bu indirim kodu daha önce oluşturulmuş."
          : message,
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const id = readId((await params).id);
    await getD1()
      .prepare("DELETE FROM discount_codes WHERE id = ?")
      .bind(id)
      .run();
    return Response.json({ discountCodes: await readDiscountCodes() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "İndirim kodu silinemedi.",
      },
      { status: 400 },
    );
  }
}
