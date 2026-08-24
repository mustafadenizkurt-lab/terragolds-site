import { compare, hash } from "bcryptjs";
import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const customer = await getCustomerFromRequest(request);
  if (!customer) return customerUnauthorizedResponse();

  const body = (await request.json()) as Record<string, unknown>;
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (newPassword.length < 10 || newPassword.length > 128) {
    return Response.json(
      { error: "Yeni şifre 10-128 karakter arasında olmalı." },
      { status: 400 },
    );
  }

  if (newPassword !== confirmPassword) {
    return Response.json(
      { error: "Yeni şifreler eşleşmiyor." },
      { status: 400 },
    );
  }

  const user = await getD1()
    .prepare("SELECT password_hash FROM users WHERE id = ? AND email = ?")
    .bind(customer.id, customer.email)
    .first<{ password_hash: string }>();

  const passwordMatches =
    user && currentPassword.length <= 128
      ? await compare(currentPassword, user.password_hash)
      : false;

  if (!user || !passwordMatches) {
    return Response.json(
      { error: "Mevcut şifre hatalı." },
      { status: 400 },
    );
  }

  const passwordHash = await hash(newPassword, 12);
  await getD1()
    .prepare(
      `UPDATE users
       SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(passwordHash, customer.id)
    .run();

  return Response.json({ ok: true });
}
