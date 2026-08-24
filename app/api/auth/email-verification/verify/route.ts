import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import { verifyAccountEmailToken } from "../../../../../lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { token?: unknown };
    const token = String(body.token ?? "").trim().slice(0, 500);
    if (!token) {
      return Response.json(
        { error: "Doğrulama bağlantısı eksik." },
        { status: 400 },
      );
    }
    const result = await verifyAccountEmailToken(token);
    return Response.json({ ok: true, email: result.email });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "E-posta doğrulanamadı.",
      },
      { status: 400 },
    );
  }
}
