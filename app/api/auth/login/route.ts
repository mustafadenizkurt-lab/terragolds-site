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
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 190);
    const password = String(body.password ?? "");
    const captchaAnswer = String(body.captchaAnswer ?? "");

    const loginAttempt = await readLoginAttempt(email);
    if (
      loginCaptchaRequired(loginAttempt) &&
      !verifyLoginCaptcha(loginAttempt, captchaAnswer)
    ) {
      return clearCustomerSessionCookie(
        Response.json(
          {
            error: "Güvenlik doğrulamasını tamamlayın.",
            requiresCaptcha: true,
            captcha: await createLoginCaptcha(email),
          },
          { status: 403 },
        ),
      );
    }

    const user = await getD1()
      .prepare(
        `SELECT id, first_name, last_name, email, phone, password_hash, session_version
         FROM users WHERE email = ?`,
      )
      .bind(email)
      .first<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        password_hash: string;
        session_version: number;
      }>();

    const passwordMatches =
      user && password.length <= 128
        ? await compare(password, user.password_hash)
        : false;

    if (!user || !passwordMatches) {
      const failedCount = await recordFailedLogin(email);
      const requiresCaptcha = failedCount >= 3;
      return clearCustomerSessionCookie(
        Response.json(
          {
            error: "E-posta veya şifre hatalı.",
            requiresCaptcha,
            captcha: requiresCaptcha ? await createLoginCaptcha(email) : undefined,
          },
          { status: 401 },
        ),
      );
    }

    await clearFailedLogins(email);
    const token = await createCustomerSessionToken({
      userId: user.id,
      email: user.email,
      sessionVersion: user.session_version,
    });
    return setCustomerSessionCookie(
      Response.json({
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          phone: user.phone,
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
