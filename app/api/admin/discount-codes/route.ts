import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import { parseDiscountCodeInput } from "../../../../lib/discount-code-input";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export type DiscountCodeAdminRow = {
  id: number;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumOrderAmount: number;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function readDiscountCodes() {
  const rows = await getD1()
    .prepare(
      `SELECT id, code, description, discount_type, discount_value,
              minimum_order_amount, usage_limit, used_count, active,
              starts_at, expires_at, created_at, updated_at
       FROM discount_codes ORDER BY created_at DESC, id DESC`,
    )
    .all<{
      id: number;
      code: string;
      description: string;
      discount_type: "percent" | "fixed";
      discount_value: number;
      minimum_order_amount: number;
      usage_limit: number;
      used_count: number;
      active: number;
      starts_at: string | null;
      expires_at: string | null;
      created_at: string;
      updated_at: string;
    }>();
  return rows.results.map(
    (row) =>
      ({
        id: row.id,
        code: row.code,
        description: row.description,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        minimumOrderAmount: row.minimum_order_amount,
        usageLimit: row.usage_limit,
        usedCount: row.used_count,
        active: Boolean(row.active),
        startsAt: row.starts_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }) satisfies DiscountCodeAdminRow,
  );
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json({ discountCodes: await readDiscountCodes() });
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const input = parseDiscountCodeInput(
      (await request.json()) as Record<string, unknown>,
    );
    await getD1()
      .prepare(
        `INSERT INTO discount_codes
          (code, description, discount_type, discount_value,
           minimum_order_amount, usage_limit, active, starts_at, expires_at,
           updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
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
      )
      .run();
    return Response.json(
      { discountCodes: await readDiscountCodes() },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "İndirim kodu oluşturulamadı.";
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
