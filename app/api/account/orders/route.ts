import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
} from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  payment_id: string | null;
  shipping_address: string;
  shipping_district: string;
  shipping_city: string;
  shipping_postcode: string;
  created_at: string;
};

export async function GET(request: Request) {
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();

  const db = getD1();
  await db
    .prepare(
      `UPDATE orders
       SET status = 'delivered',
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?
         AND status = 'shipped'
         AND shipped_at IS NOT NULL
         AND datetime(shipped_at) <= datetime('now', '-7 days')`,
    )
    .bind(user.id)
    .run();

  const orderRows = await db
    .prepare(
      `SELECT id, status, total_amount, currency, payment_id,
              shipping_address, shipping_district, shipping_city,
              shipping_postcode, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .bind(user.id)
    .all<OrderRow>();

  const orders = await Promise.all(
    orderRows.results.map(async (order) => {
      const items = await db
        .prepare(
          `SELECT product_id, product_name, unit_price, quantity
           FROM order_items WHERE order_id = ? ORDER BY id`,
        )
        .bind(order.id)
        .all<{
          product_id: number | null;
          product_name: string;
          unit_price: number;
          quantity: number;
        }>();

      return {
        id: order.id,
        status: order.status,
        totalAmount: order.total_amount,
        currency: order.currency,
        paymentId: order.payment_id,
        address: [
          order.shipping_address,
          order.shipping_district,
          order.shipping_city,
          order.shipping_postcode,
        ]
          .filter(Boolean)
          .join(", "),
        createdAt: order.created_at,
        items: items.results.map((item) => ({
          productId: item.product_id,
          name: item.product_name,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        })),
      };
    }),
  );

  return Response.json(
    { user, orders },
    { headers: { "cache-control": "no-store" } },
  );
}
