import { hash } from "bcryptjs";
import {
  createCustomerSessionToken,
  isSameOriginRequest,
  setCustomerSessionCookie,
} from "../../../../lib/customer-auth";
import { normalizeCustomerName } from "../../../../lib/customer-name";
import { createEmailVerification } from "../../../../lib/email-verification";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const firstName = normalizeCustomerName(body.firstName);
    const lastName = normalizeCustomerName(body.lastName);
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 190);
    const phone = String(body.phone ?? "").trim().slice(0, 30);
    const password = String(body.password ?? "");

    if (!firstName || !lastName || !emailPattern.test(email)) {
      return Response.json(
        { error: "Ad, soyad ve geçerli bir e-posta adresi gereklidir." },
        { status: 400 },
      );
    }
    if (password.length < 10 || password.length > 128) {
      return Response.json(
        { error: "Şifre 10–128 karakter arasında olmalıdır." },
        { status: 400 },
      );
    }

    const db = getD1();
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (existing) {
      return Response.json(
        { error: "Bu e-posta adresiyle daha önce hesap oluşturulmuş." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 12);
    const created = await db
      .prepare(
        `INSERT INTO users
          (first_name, last_name, email, phone, password_hash, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`,
      )
      .bind(firstName, lastName, email, phone, passwordHash)
      .first<{ id: number }>();

    if (!created) throw new Error("Hesap oluşturulamadı.");
    let verification:
      | {
          sent: boolean;
          devCode?: string;
          devVerifyUrl?: string;
        }
      | undefined;
    let verificationWarning = "";
    try {
      verification = await createEmailVerification({
        email,
        userId: created.id,
        kind: "account",
        origin: new URL(request.url).origin,
      });
    } catch (verificationError) {
      verificationWarning =
        verificationError instanceof Error
          ? verificationError.message
          : "Doğrulama e-postası gönderilemedi.";
    }
    const token = await createCustomerSessionToken({
      userId: created.id,
      email,
      sessionVersion: 0,
    });
    return setCustomerSessionCookie(
      Response.json(
        {
          user: {
            id: created.id,
            firstName,
            lastName,
            email,
            phone,
            emailVerifiedAt: null,
          },
          verification,
          verificationWarning,
        },
        { status: 201 },
      ),
      token,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Hesap oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}
