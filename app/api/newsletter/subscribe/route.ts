import { isSameOriginRequest } from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email)) {
    return Response.json(
      { error: "Geçerli bir e-posta adresi girin." },
      { status: 400 },
    );
  }

  // Re-submitting an already-subscribed address is a normal, expected case
  // (not an error the visitor needs to see) - INSERT OR IGNORE relies on
  // the newsletter_subscribers_email_unique index to make it a silent no-op.
  await getD1()
    .prepare("INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)")
    .bind(email)
    .run();

  return Response.json({ ok: true });
}
