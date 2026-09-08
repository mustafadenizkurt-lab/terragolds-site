import { getShopifyAccessToken } from "./auth";
import {
  ensureShopifyColumns,
  getPrimaryLocationId,
  shopifyGraphQL,
} from "./client";

type ProductRow = {
  stock: number;
  shopifyProductId: string | null;
  shopifyInventoryItemId: string | null;
};

async function fetchInventoryItemId(
  accessToken: string,
  shopifyProductId: string,
): Promise<string | null> {
  const data = await shopifyGraphQL<{
    product: {
      variants: { nodes: { inventoryItem: { id: string } }[] };
    } | null;
  }>(
    accessToken,
    `query product($id: ID!) {
      product(id: $id) {
        variants(first: 1) { nodes { inventoryItem { id } } }
      }
    }`,
    { id: shopifyProductId },
  );
  return data.product?.variants.nodes[0]?.inventoryItem.id ?? null;
}

// D1 is the source of truth for stock - every place that changes
// products.stock (a site sale, an XML supplier update, an admin edit, or
// this module's own Shopify-order webhook handler) calls this afterwards
// to push the current value to Shopify. Failures are the caller's to
// decide how to handle (this function only throws, never silently drops
// an error) - a Shopify hiccup should never be allowed to block the D1
// write that already happened.
export async function pushInventoryToShopify(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureShopifyColumns(db);

  const product = await db
    .prepare(
      `SELECT stock, shopify_product_id AS shopifyProductId,
              shopify_inventory_item_id AS shopifyInventoryItemId
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<ProductRow>();

  // Not synced to Shopify yet (or never will be, e.g. a draft product) -
  // nothing to push. syncProductsToShopify() will pick up its initial
  // stock whenever it's first created there.
  if (!product?.shopifyProductId) return;

  const accessToken = await getShopifyAccessToken();

  let inventoryItemId = product.shopifyInventoryItemId;
  if (!inventoryItemId) {
    inventoryItemId = await fetchInventoryItemId(
      accessToken,
      product.shopifyProductId,
    );
    if (!inventoryItemId) return;
    await db
      .prepare(
        "UPDATE products SET shopify_inventory_item_id = ? WHERE id = ?",
      )
      .bind(inventoryItemId, productId)
      .run();
  }

  const locationId = await getPrimaryLocationId(accessToken);

  const data = await shopifyGraphQL<{
    inventorySetQuantities: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(
    accessToken,
    `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        name: "available",
        reason: "correction",
        quantities: [
          {
            inventoryItemId,
            locationId,
            quantity: product.stock,
            // D1 is authoritative - always overwrite Shopify's current
            // value rather than rejecting on a stale-compare mismatch.
            changeFromQuantity: null,
          },
        ],
      },
    },
  );
  if (data.inventorySetQuantities.userErrors.length) {
    throw new Error(
      data.inventorySetQuantities.userErrors
        .map((error) => error.message)
        .join(", "),
    );
  }
}
