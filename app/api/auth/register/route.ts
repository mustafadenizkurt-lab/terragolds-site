import { hash } from "bcryptjs";
import {
  createCustomerSessionToken,
  isSameOriginRequest,
  setCustomerSessionCookie,
} from "../../../../lib/customer-auth";
import { normalizeCustomerName } from "../../../../lib/customer-name";
import { createEmailVerification } from "../../../../lib/email-verification";
import { normalizePhoneDigits } from "../../../../lib/phone";
import { attributeNewCustomerReferral } from "../../../../lib/partner-referral";
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
    const emailInput = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 190);
    const email = emailInput || null;
    const phoneDigits = normalizePhoneDigits(body.phone);
    const password = String(body.password ?? "");

    if (!firstName || !lastName) {
      return Response.json(
        { error: "Ad ve soyad alanları zorunludur." },
        { status: 400 },
      );
    }
    if (email && !emailPattern.test(email)) {
      return Response.json(
        { error: "Geçerli bir e-posta adresi girin." },
        { status: 400 },
      );
    }
    // E-posta artık zorunlu değil (müşteri kaçışını azaltmak için) ama giriş
    // yapabilmek için MUTLAKA bir kimlik gerekiyor - e-posta yoksa telefon
    // zorunlu hale geliyor (bkz. lib/customer-auth.ts, login/route.ts).
    if (!email && !phoneDigits) {
      return Response.json(
        { error: "E-posta veya telefon numarasından en az biri gereklidir." },
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
    if (email) {
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
    }
    if (phoneDigits) {
      const existingPhone = await db
        .prepare("SELECT id FROM users WHERE phone = ? AND phone != ''")
        .bind(phoneDigits)
        .first<{ id: number }>();
      if (existingPhone) {
        return Response.json(
          { error: "Bu telefon numarasıyla daha önce hesap oluşturulmuş." },
          { status: 409 },
        );
      }
    }

    const passwordHash = await hash(password, 12);
    const created = await db
      .prepare(
        `INSERT INTO users
          (first_name, last_name, email, phone, password_hash, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`,
      )
      .bind(firstName, lastName, email, phoneDigits ?? "", passwordHash)
      .first<{ id: number }>();

    if (!created) throw new Error("Hesap oluşturulamadı.");
    try {
      await attributeNewCustomerReferral(db, created.id, request);
    } catch {
      // A referral cookie/lookup problem should never block account creation.
    }
    let verification:
      | {
          sent: boolean;
          devCode?: string;
          devVerifyUrl?: string;
        }
      | undefined;
    let verificationWarning = "";
    if (email) {
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
    }
    const token = await createCustomerSessionToken({
      userId: created.id,
      email: email ?? "",
      sessionVersion: 0,
    });
    return setCustomerSessionCookie(
      Response.json(
        {
          user: {
            id: created.id,
            firstName,
            lastName,
            email: email ?? "",
            phone: phoneDigits ?? "",
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
