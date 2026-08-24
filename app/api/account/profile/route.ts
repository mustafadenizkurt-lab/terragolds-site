import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import { normalizeCustomerName } from "../../../../lib/customer-name";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();
  return Response.json(
    { user },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();

  const body = (await request.json()) as Record<string, unknown>;
  const firstName = normalizeCustomerName(body.firstName);
  const lastName = normalizeCustomerName(body.lastName);
  const phone = String(body.phone ?? "").trim().slice(0, 30);
  if (!firstName || !lastName) {
    return Response.json(
      { error: "Ad ve soyad alanları zorunludur." },
      { status: 400 },
    );
  }

  await getD1()
    .prepare(
      `UPDATE users
       SET first_name = ?, last_name = ?, phone = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(firstName, lastName, phone, user.id)
    .run();

  return Response.json({
    user: { ...user, firstName, lastName, phone },
  });
}
