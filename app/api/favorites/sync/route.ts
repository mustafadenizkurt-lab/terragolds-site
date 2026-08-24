import {
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const visitorId = String(body.visitorId ?? "").trim().slice(0, 80);
    const productIds = Array.isArray(body.productIds)
      ? [
          ...new Set(
            body.productIds
              .map(Number)
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        ].slice(0, 250)
      : [];

    if (!/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) {
      return Response.json({ error: "Geçersiz ziyaretçi kaydı." }, { status: 400 });
    }

    const customer = await getCustomerFromRequest(request);
    const db = getD1();
    await db.batch([
      db
        .prepare("DELETE FROM product_favorites WHERE visitor_id = ?")
        .bind(visitorId),
      ...productIds.map((productId) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO product_favorites
              (visitor_id, user_id, product_id)
             SELECT ?, ?, id FROM products WHERE id = ?`,
          )
          .bind(visitorId, customer?.id ?? null, productId),
      ),
    ]);

    return Response.json({ ok: true, count: productIds.length });
  } catch {
    return Response.json(
      { error: "Favoriler eşitlenemedi." },
      { status: 500 },
    );
  }
}
