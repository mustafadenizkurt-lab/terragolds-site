import { compare } from "bcryptjs";
import {
  clearCustomerSessionCookie,
  createCustomerSessionToken,
  isSameOriginRequest,
  setCustomerSessionCookie,
} from "../../../../lib/customer-auth";
import {
  clearFailedLogins,
  createLoginCaptcha,
  loginCaptchaRequired,
  readLoginAttempt,
  recordFailedLogin,
  verifyLoginCaptcha,
} from "../../../../lib/login-captcha";
import { normalizePhoneDigits } from "../../../../lib/phone";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    // Giriş alanı e-posta VEYA telefon kabul ediyor - e-postasız (telefonla)
    // kayıt olan müşterinin girecek başka bir kimliği yok (bkz.
    // app/api/auth/register/route.ts). login_attempts/captcha tablosu da bu
    // aynı "identifier" değeriyle anahtarlanıyor.
    const identifierRaw = String(body.email ?? "").trim();
    const isEmailLogin = emailPattern.test(identifierRaw);
    const email = isEmailLogin ? identifierRaw.toLowerCase().slice(0, 190) : "";
    const phoneDigits = isEmailLogin ? null : normalizePhoneDigits(identifierRaw);
    const identifierKey = isEmailLogin ? email : phoneDigits ?? identifierRaw;
    const password = String(body.password ?? "");
    const captchaAnswer = String(body.captchaAnswer ?? "");

    const loginAttempt = await readLoginAttempt(identifierKey);
    if (
      loginCaptchaRequired(loginAttempt) &&
      !verifyLoginCaptcha(loginAttempt, captchaAnswer)
    ) {
      return clearCustomerSessionCookie(
        Response.json(
          {
            error: "Güvenlik doğrulamasını tamamlayın.",
            requiresCaptcha: true,
            captcha: await createLoginCaptcha(identifierKey),
          },
          { status: 403 },
        ),
      );
    }

    const user = isEmailLogin
      ? await getD1()
          .prepare(
            `SELECT id, first_name, last_name, email, phone, password_hash, session_version, role
             FROM users WHERE email = ?`,
          )
          .bind(email)
          .first<{
            id: number;
            first_name: string;
            last_name: string;
            email: string | null;
            phone: string;
            password_hash: string;
            session_version: number;
            role: string;
          }>()
      : phoneDigits
        ? await getD1()
            .prepare(
              `SELECT id, first_name, last_name, email, phone, password_hash, session_version, role
               FROM users WHERE phone = ? AND phone != ''`,
            )
            .bind(phoneDigits)
            .first<{
              id: number;
              first_name: string;
              last_name: string;
              email: string | null;
              phone: string;
              password_hash: string;
              session_version: number;
              role: string;
            }>()
        : null;

    const passwordMatches =
      user && password.length <= 128
        ? await compare(password, user.password_hash)
        : false;

    if (!user || !passwordMatches) {
      const failedCount = await recordFailedLogin(identifierKey);
      const requiresCaptcha = failedCount >= 3;
      return clearCustomerSessionCookie(
        Response.json(
          {
            error: "E-posta/telefon veya şifre hatalı.",
            requiresCaptcha,
            captcha: requiresCaptcha
              ? await createLoginCaptcha(identifierKey)
              : undefined,
          },
          { status: 401 },
        ),
      );
    }

    await clearFailedLogins(identifierKey);
    const token = await createCustomerSessionToken({
      userId: user.id,
      email: user.email ?? "",
      sessionVersion: user.session_version,
    });
    return setCustomerSessionCookie(
      Response.json({
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email ?? "",
          phone: user.phone,
          role: user.role,
        },
      }),
      token,
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Giriş yapılamadı.",
      },
      { status: 500 },
    );
  }
}
