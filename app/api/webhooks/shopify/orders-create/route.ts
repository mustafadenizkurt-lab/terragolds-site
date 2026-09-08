import { getRequiredEnv } from "../../../../../lib/runtime-env";
import {
  constantTimeEquals,
  hmacSha256,
} from "../../../../../lib/payment-signatures";
import { getD1 } from "../../../../../lib/store-db";
import { importShopifyOrder } from "../../../../../lib/shopify/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // HMAC is computed over the exact raw request bytes Shopify sent - must
  // read as text before any JSON parsing, or the signature won't match.
  const rawBody = await request.text();
  const signature = request.headers.get("x-shopify-hmac-sha256");
  if (!signature) {
    return new Response("missing signature", { status: 401 });
  }

  const secret = getRequiredEnv("SHOPIFY_CLIENT_SECRET");
  const expectedSignature = await hmacSha256(rawBody, secret, "base64");
  if (!constantTimeEquals(expectedSignature, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { id: number };
  try {
    payload = JSON.parse(rawBody) as { id: number };
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  await importShopifyOrder(getD1(), payload, rawBody);

  return Response.json({ ok: true });
}
