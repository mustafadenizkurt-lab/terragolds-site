import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import type { AdminShippingOrder } from "../../../../lib/admin-dashboard-types";
import {
  createAutoDeliverAt,
  createShippingTrackingUrl,
} from "../../../../lib/shipping-tracking-link";
import { getShippingTrackingSettings } from "../../../../lib/shipping-tracking-settings";
import { getD1 } from "../../../../lib/store-db";
import { ensureOrderCheckoutColumns } from "../../../../lib/checkout-order";
import { reverseEarnedPoints } from "../../../../lib/loyalty";
import { ensureShopifyOrdersTable } from "../../../../lib/shopify/orders";
import { fulfillShopifyOrder } from "../../../../lib/shopify/fulfillment";

export const dynamic = "force-dynamic";

const editableStatuses = new Set([
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const db = getD1();
    await ensureShopifyOrdersTable(db);
    await ensureOrderCheckoutColumns(db);
    await db
      .prepare(
        `UPDATE orders
         SET status = 'delivered',
             delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'shipped'
           AND shipped_at IS NOT NULL
           AND datetime(shipped_at) <= datetime('now', '-7 days')`,
      )
      .run();

    const [orders, items, trackingSettings, shopifyOrders] = await Promise.all([
      db
        .prepare(
          `SELECT id, status, customer_first_name, customer_last_name,
                  customer_email, customer_phone, shipping_address,
                  shipping_district, shipping_city, shipping_postcode,
                  subtotal_amount, discount_amount, shipping_amount,
                  discount_code, total_amount, currency, payment_provider, customer_note,
                  gift_wrap, gift_message, is_cod,
                  shipping_carrier, tracking_number, shipped_at,
                  delivered_at, created_at
           FROM orders
           WHERE status IN ('pending', 'paid', 'shipped', 'delivered')
           ORDER BY
             CASE status
               WHEN 'paid' THEN 0
               WHEN 'pending' THEN 1
               WHEN 'shipped' THEN 2
               ELSE 3
             END,
             created_at DESC
           LIMIT 150`,
        )
        .all<{
          id: string;
          status: string;
          customer_first_name: string;
          customer_last_name: string;
          customer_email: string;
          customer_phone: string;
          shipping_address: string;
          shipping_district: string;
          shipping_city: string;
          shipping_postcode: string;
          subtotal_amount: number;
          discount_amount: number;
          shipping_amount: number;
          discount_code: string | null;
          total_amount: number;
          currency: string;
          payment_provider: string;
          customer_note: string;
          gift_wrap: number;
          gift_message: string;
          is_cod: number;
          shipping_carrier: string;
          tracking_number: string;
          shipped_at: string | null;
          delivered_at: string | null;
          created_at: string;
        }>(),
      db
        .prepare(
          `SELECT order_id, product_name, quantity, unit_price
           FROM order_items
           ORDER BY id`,
        )
        .all<{
          order_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
        }>(),
      getShippingTrackingSettings(),
      db
        .prepare(
          `SELECT id, status, customer_first_name, customer_last_name,
                  customer_email, customer_phone, shipping_address,
                  shipping_district, shipping_city, shipping_postcode,
                  subtotal_amount, discount_amount, shipping_amount,
                  total_amount, currency, customer_note, shipping_carrier,
                  tracking_number, shipped_at, delivered_at, items_json,
                  created_at
           FROM shopify_orders
           WHERE status IN ('pending', 'paid', 'shipped', 'delivered')
           ORDER BY created_at DESC
           LIMIT 150`,
        )
        .all<{
          id: string;
          status: string;
          customer_first_name: string;
          customer_last_name: string;
          customer_email: string;
          customer_phone: string;
          shipping_address: string;
          shipping_district: string;
          shipping_city: string;
          shipping_postcode: string;
          subtotal_amount: number;
          discount_amount: number;
          shipping_amount: number;
          total_amount: number;
          currency: string;
          customer_note: string;
          shipping_carrier: string;
          tracking_number: string;
          shipped_at: string | null;
          delivered_at: string | null;
          items_json: string;
          created_at: string;
        }>(),
    ]);

    const itemsByOrder = new Map<
      string,
      AdminShippingOrder["items"]
    >();
    for (const item of items.results) {
      const orderItems = itemsByOrder.get(item.order_id) ?? [];
      orderItems.push({
        name: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      });
      itemsByOrder.set(item.order_id, orderItems);
    }

    const shippingOrders: AdminShippingOrder[] = orders.results.map(
      (order) => ({
        id: order.id,
        status: order.status,
        customerName:
          `${order.customer_first_name} ${order.customer_last_name}`.trim(),
        email: order.customer_email,
        phone: order.customer_phone,
        address: [
          order.shipping_address,
          order.shipping_district,
          order.shipping_city,
          order.shipping_postcode,
        ]
          .filter(Boolean)
          .join(", "),
        subtotalAmount: Number(order.subtotal_amount) || 0,
        discountAmount: Number(order.discount_amount) || 0,
        shippingAmount: Number(order.shipping_amount) || 0,
        discountCode: order.discount_code,
        totalAmount: Number(order.total_amount) || 0,
        currency: order.currency,
        paymentProvider: order.payment_provider,
        salesChannel: "terragolds.com",
        customerNote: order.customer_note,
        giftWrap: Boolean(order.gift_wrap),
        giftMessage: order.gift_message,
        isCod: Boolean(order.is_cod),
        shippingCarrier: order.shipping_carrier,
        trackingNumber: order.tracking_number,
        trackingUrl: createShippingTrackingUrl({
          carrier: order.shipping_carrier,
          trackingNumber: order.tracking_number,
        }),
        autoDeliverAt:
          order.status === "shipped"
            ? createAutoDeliverAt(order.shipped_at)
            : null,
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
        createdAt: order.created_at,
        items: itemsByOrder.get(order.id) ?? [],
      }),
    );

    const shopifyShippingOrders: AdminShippingOrder[] =
      shopifyOrders.results.map((order) => {
        let parsedItems: AdminShippingOrder["items"] = [];
        try {
          parsedItems = (
            JSON.parse(order.items_json) as {
              name: string;
              quantity: number;
              unitPrice: number;
            }[]
          ).map((item) => ({
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          }));
        } catch {
          parsedItems = [];
        }
        return {
          id: order.id,
          status: order.status,
          customerName:
            `${order.customer_first_name} ${order.customer_last_name}`.trim(),
          email: order.customer_email,
          phone: order.customer_phone,
          address: [
            order.shipping_address,
            order.shipping_district,
            order.shipping_city,
            order.shipping_postcode,
          ]
            .filter(Boolean)
            .join(", "),
          subtotalAmount: Number(order.subtotal_amount) || 0,
          discountAmount: Number(order.discount_amount) || 0,
          shippingAmount: Number(order.shipping_amount) || 0,
          discountCode: null,
          totalAmount: Number(order.total_amount) || 0,
          currency: order.currency,
          paymentProvider: "shopify",
          salesChannel: "shopify",
          customerNote: order.customer_note,
          giftWrap: false,
          giftMessage: "",
          isCod: false,
          shippingCarrier: order.shipping_carrier,
          trackingNumber: order.tracking_number,
          trackingUrl: createShippingTrackingUrl({
            carrier: order.shipping_carrier,
            trackingNumber: order.tracking_number,
          }),
          autoDeliverAt:
            order.status === "shipped"
              ? createAutoDeliverAt(order.shipped_at)
              : null,
          shippedAt: order.shipped_at,
          deliveredAt: order.delivered_at,
          createdAt: order.created_at,
          items: parsedItems,
        };
      });

    const combinedOrders = [...shippingOrders, ...shopifyShippingOrders].sort(
      (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
    );

    return Response.json(
      { orders: combinedOrders, trackingSettings },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Kargo kayıtları alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim().slice(0, 80);
    const status = String(body.status ?? "").trim();
    const shippingCarrier = String(body.shippingCarrier ?? "")
      .trim()
      .slice(0, 80);
    const trackingNumber = String(body.trackingNumber ?? "")
      .trim()
      .slice(0, 120);

    if (!id || !editableStatuses.has(status)) {
      return Response.json({ error: "Geçersiz kargo güncellemesi." }, { status: 400 });
    }
    if (
      ["shipped", "delivered"].includes(status) &&
      (!shippingCarrier || !trackingNumber)
    ) {
      return Response.json(
        { error: "Kargoya vermek için firma ve takip numarası gereklidir." },
        { status: 400 },
      );
    }

    const db = getD1();
    await ensureShopifyOrdersTable(db);
    await ensureOrderCheckoutColumns(db);

    let table: "orders" | "shopify_orders" = "orders";
    let current = await db
      .prepare("SELECT status FROM orders WHERE id = ? LIMIT 1")
      .bind(id)
      .first<{ status: string }>();
    if (!current) {
      table = "shopify_orders";
      current = await db
        .prepare("SELECT status FROM shopify_orders WHERE id = ? LIMIT 1")
        .bind(id)
        .first<{ status: string }>();
    }
    if (!current) {
      return Response.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }
    const validTransition =
      current.status === status ||
      (current.status === "paid" && status === "shipped") ||
      (current.status === "shipped" && status === "delivered") ||
      (status === "cancelled" &&
        ["pending", "paid", "shipped"].includes(current.status));
    if (!validTransition) {
      return Response.json(
        { error: "Sipariş bu duruma geçirilemez." },
        { status: 409 },
      );
    }

    const result = await db
      .prepare(
        `UPDATE ${table}
         SET status = ?, shipping_carrier = ?, tracking_number = ?,
             shipped_at = CASE
               WHEN ? IN ('shipped', 'delivered')
                 THEN COALESCE(shipped_at, CURRENT_TIMESTAMP)
               ELSE shipped_at
             END,
             delivered_at = CASE
               WHEN ? = 'delivered'
                 THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
               ELSE delivered_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('pending', 'paid', 'shipped', 'delivered')`,
      )
      .bind(
        status,
        shippingCarrier,
        trackingNumber,
        status,
        status,
        id,
      )
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    // Cancelling an order that had already earned loyalty points claws
    // them back - a no-op if it never actually reached 'paid' (nothing was
    // ever earned to reverse).
    if (table === "orders" && status === "cancelled") {
      try {
        await reverseEarnedPoints(db, id);
      } catch {
        // Never block the cancellation itself over a loyalty hiccup.
      }
    }

    // Terragolds admin is the only place shipping status is edited - this
    // just reports "shipped" to Shopify (one-directional) so the customer
    // sees the right status there too. A failure here doesn't roll back the
    // D1 update above (that stays authoritative); the admin is told to
    // check Shopify manually instead.
    if (table === "shopify_orders" && status === "shipped") {
      try {
        await fulfillShopifyOrder(id, shippingCarrier, trackingNumber);
      } catch (error) {
        return Response.json({
          ok: true,
          warning: `Sipariş güncellendi ama Shopify'a bildirilemedi: ${
            error instanceof Error ? error.message : "bilinmeyen hata"
          }`,
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Kargo kaydı güncellenemedi.",
      },
      { status: 400 },
    );
  }
}
