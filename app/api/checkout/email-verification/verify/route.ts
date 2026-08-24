import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  setCheckoutEmailVerificationCookie,
  verifyCheckoutEmailCode,
} from "../../../../../lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 190);
    const code = String(body.code ?? "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      return Response.json(
        { error: "6 haneli doğrulama kodunu yazın." },
        { status: 400 },
      );
    }
    const verifiedEmail = await verifyCheckoutEmailCode(email, code);
    return setCheckoutEmailVerificationCookie(
      Response.json({ ok: true, email: verifiedEmail }),
      verifiedEmail,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Doğrulama kodu kabul edilmedi.",
      },
      { status: 400 },
    );
  }
}
