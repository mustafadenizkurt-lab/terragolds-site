import { getRequiredEnv } from "../../../../../lib/runtime-env";
import {
  constantTimeEquals,
  hmacSha256,
} from "../../../../../lib/payment-signatures";
import { getD1 } from "../../../../../lib/store-db";
import { pushInventoryToShopify } from "../../../../../lib/shopify/inventory";

export const dynamic = "force-dynamic";

type ShopifyOrderPayload = {
  id: number;
  line_items?: { product_id: number | null; quantity: number }[];
};

async function ensureProcessedOrdersTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS shopify_processed_orders (
        shopify_order_id TEXT PRIMARY KEY,
        processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

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

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  const db = getD1();
  await ensureProcessedOrdersTable(db);

  // Atomic idempotency claim: Shopify retries webhook deliveries on
  // timeout/failure, and the same order can legitimately fire this webhook
  // more than once. INSERT OR IGNORE + checking `changes` lets exactly one
  // request "win" the right to apply this order's stock effect, with no
  // separate read-then-write race window.
  const claim = await db
    .prepare(
      "INSERT OR IGNORE INTO shopify_processed_orders (shopify_order_id) VALUES (?)",
    )
    .bind(String(payload.id))
    .run();
  if (claim.meta.changes === 0) {
    return Response.json({ ok: true, duplicate: true });
  }

  const affectedProductIds = new Set<number>();
  for (const item of payload.line_items ?? []) {
    if (!item.product_id || item.quantity <= 0) continue;
    const shopifyProductId = `gid://shopify/Product/${item.product_id}`;
    const product = await db
      .prepare("SELECT id FROM products WHERE shopify_product_id = ?")
      .bind(shopifyProductId)
      .first<{ id: number }>();
    if (!product) continue;
    // Same floor-at-zero pattern as lib/order-payment.ts's markOrderPaid,
    // for a site sale - never let a stock figure go negative.
    await db
      .prepare(
        `UPDATE products SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(item.quantity, item.quantity, product.id)
      .run();
    affectedProductIds.add(product.id);
  }

  for (const productId of affectedProductIds) {
    try {
      await pushInventoryToShopify(db, productId);
    } catch {
      // D1 already has the correct value - a push failure here self-heals
      // on the next stock change or the next scheduled sync.
    }
  }

  return Response.json({ ok: true, updated: affectedProductIds.size });
}
