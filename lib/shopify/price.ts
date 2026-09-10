import { getShopifyAccessToken } from "./auth";
import { ensureShopifyColumns, shopifyGraphQL } from "./client";

type ProductRow = {
  price: number;
  shopifyProductId: string | null;
};

async function fetchVariantId(
  accessToken: string,
  shopifyProductId: string,
): Promise<string | null> {
  const data = await shopifyGraphQL<{
    product: { variants: { nodes: { id: string }[] } } | null;
  }>(
    accessToken,
    `query product($id: ID!) {
      product(id: $id) {
        variants(first: 1) { nodes { id } }
      }
    }`,
    { id: shopifyProductId },
  );
  return data.product?.variants.nodes[0]?.id ?? null;
}

// Mirrors pushInventoryToShopify - D1 is the source of truth for price, so
// every place that changes products.price for an already-synced product
// calls this afterwards. Never call this unconditionally over many products
// in one request; see pushPendingShopifyPrices below for that case.
export async function pushPriceToShopify(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureShopifyColumns(db);

  const product = await db
    .prepare(
      `SELECT price, shopify_product_id AS shopifyProductId FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<ProductRow>();

  // Not synced to Shopify yet - nothing to push. syncProductsToShopify()
  // will pick up its initial price whenever it's first created there.
  if (!product?.shopifyProductId) return;

  const accessToken = await getShopifyAccessToken();
  const variantId = await fetchVariantId(accessToken, product.shopifyProductId);
  if (!variantId) return;

  const data = await shopifyGraphQL<{
    productVariantsBulkUpdate: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    {
      productId: product.shopifyProductId,
      variants: [{ id: variantId, price: product.price.toFixed(2) }],
    },
  );
  if (data.productVariantsBulkUpdate.userErrors.length) {
    throw new Error(
      data.productVariantsBulkUpdate.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }

  await db
    .prepare("UPDATE products SET shopify_price_synced = ? WHERE id = ?")
    .bind(product.price, productId)
    .run();
}

export type PricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// Batched backfill for products whose D1 price has changed since it was last
// pushed to Shopify (or never pushed at all) - e.g. after a bulk reprice
// across a whole supplier, which deliberately does NOT push per-row (that
// would mean thousands of sequential Shopify calls in one request, the same
// execution/subrequest-limit trap pushInventoryToShopify's own comment
// warns about). Call this repeatedly (like syncProductsToShopify) until
// `remaining` is 0.
export async function pushPendingShopifyPrices(
  db: D1Database,
  batchSize = 25,
): Promise<PricePushResult> {
  await ensureShopifyColumns(db);

  const pending = await db
    .prepare(
      `SELECT id FROM products
       WHERE shopify_product_id IS NOT NULL
         AND (shopify_price_synced IS NULL OR shopify_price_synced != price)
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE shopify_product_id IS NOT NULL
           AND (shopify_price_synced IS NULL OR shopify_price_synced != price)`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of pending.results) {
    try {
      await pushPriceToShopify(db, row.id);
      pushed += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `#${row.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  return { pushed, failed, remaining: await remainingCount(), errors };
}
