export async function ensureShopifyOrdersTable(db: D1Database) {
  // Deliberately a separate table from `orders`, not a shared one: `orders`
  // has a CHECK constraint on payment_provider that only allows
  // ('shopier','paytr','iyzico') - widening it would require rebuilding a
  // live table that holds real customer orders. Keeping Shopify orders
  // here and merging the two at read time (see app/api/admin/shipping)
  // gives the same unified admin view with none of that risk.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS shopify_orders (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'paid',
        customer_first_name TEXT NOT NULL DEFAULT '',
        customer_last_name TEXT NOT NULL DEFAULT '',
        customer_email TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        shipping_address TEXT NOT NULL DEFAULT '',
        shipping_district TEXT NOT NULL DEFAULT '',
        shipping_city TEXT NOT NULL DEFAULT '',
        shipping_postcode TEXT NOT NULL DEFAULT '',
        shipping_country TEXT NOT NULL DEFAULT '',
        subtotal_amount INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        shipping_amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'TRY',
        customer_note TEXT NOT NULL DEFAULT '',
        shipping_carrier TEXT NOT NULL DEFAULT '',
        tracking_number TEXT NOT NULL DEFAULT '',
        shopify_fulfillment_id TEXT,
        shipped_at TEXT,
        delivered_at TEXT,
        items_json TEXT NOT NULL DEFAULT '[]',
        raw_payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

export type ShopifyOrderLineItem = {
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

type ShopifyOrderPayload = {
  id: number;
  financial_status?: string;
  currency?: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  email?: string;
  phone?: string;
  note?: string;
  subtotal_price?: string;
  total_discounts?: string;
  total_shipping_price_set?: {
    shop_money?: { amount?: string };
  };
  total_price?: string;
  shipping_address?: {
    address1?: string;
    address2?: string;
    district?: string;
    city?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  line_items?: {
    product_id: number | null;
    name: string;
    quantity: number;
    price: string;
  }[];
};

function toKurus(amount: string | undefined): number {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

// Stores every field we know how to map into real columns, *and* the
// complete raw webhook body in `raw_payload` - so nothing Shopify sent is
// ever lost even if a future report needs a field this mapping doesn't
// surface today.
export async function importShopifyOrder(
  db: D1Database,
  payload: ShopifyOrderPayload,
  rawBody: string,
): Promise<void> {
  await ensureShopifyOrdersTable(db);

  const address = payload.shipping_address;
  const items: ShopifyOrderLineItem[] = (payload.line_items ?? []).map(
    (item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: toKurus(item.price),
    }),
  );

  const subtotalAmount = toKurus(payload.subtotal_price);
  const discountAmount = toKurus(payload.total_discounts);
  const shippingAmount = toKurus(
    payload.total_shipping_price_set?.shop_money?.amount,
  );
  const totalAmount = toKurus(payload.total_price);

  await db
    .prepare(
      `INSERT OR IGNORE INTO shopify_orders (
        id, status, customer_first_name, customer_last_name, customer_email,
        customer_phone, shipping_address, shipping_district, shipping_city,
        shipping_postcode, shipping_country, subtotal_amount, discount_amount,
        shipping_amount, total_amount, currency, customer_note, items_json,
        raw_payload, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .bind(
      String(payload.id),
      payload.financial_status === "paid" ? "paid" : "pending",
      payload.customer?.first_name ?? "",
      payload.customer?.last_name ?? "",
      payload.customer?.email ?? payload.email ?? "",
      address?.phone ?? payload.phone ?? "",
      [address?.address1, address?.address2].filter(Boolean).join(", "),
      address?.district ?? "",
      address?.city ?? "",
      address?.zip ?? "",
      address?.country ?? "",
      subtotalAmount,
      discountAmount,
      shippingAmount,
      totalAmount,
      payload.currency ?? "TRY",
      payload.note ?? "",
      JSON.stringify(items),
      rawBody,
    )
    .run();
}
