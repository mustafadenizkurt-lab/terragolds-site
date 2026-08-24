import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import { createEmailVerification } from "../../../../../lib/email-verification";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 190);
    if (!emailPattern.test(email)) {
      return Response.json(
        { error: "Geçerli bir e-posta adresi yazın." },
        { status: 400 },
      );
    }
    const verification = await createEmailVerification({
      email,
      kind: "checkout",
      origin: new URL(request.url).origin,
    });
    return Response.json({ ok: true, verification });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Doğrulama kodu gönderilemedi.",
      },
      { status: 400 },
    );
  }
}
