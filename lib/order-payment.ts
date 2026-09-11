import type { PaymentProviderId } from "./payment-types";
import { computePointsEarned, ensureLoyaltyColumns, refundRedeemedPoints } from "./loyalty";
import { getD1 } from "./store-db";
import { pushInventoryToShopify } from "./shopify/inventory";

type OrderPaymentRow = {
  id: string;
  status: string;
  payment_provider: PaymentProviderId;
  payment_reference: string | null;
  payment_id: string | null;
  shopier_random_nr: string;
  total_amount: number;
  user_id: number | null;
};

export async function readPaymentOrder(orderId: string) {
  return getD1()
    .prepare(
      `SELECT id, status, payment_provider, payment_reference, payment_id,
              shopier_random_nr, total_amount, user_id
       FROM orders WHERE id = ?`,
    )
    .bind(orderId)
    .first<OrderPaymentRow>();
}

export async function readPaymentOrderByReference(
  provider: PaymentProviderId,
  reference: string,
) {
  return getD1()
    .prepare(
      `SELECT id, status, payment_provider, payment_reference, payment_id,
              shopier_random_nr, total_amount
       FROM orders
       WHERE payment_provider = ? AND payment_reference = ?`,
    )
    .bind(provider, reference)
    .first<OrderPaymentRow>();
}

export async function markOrderFailed(
  orderId: string,
  provider: PaymentProviderId,
  paymentId: string,
) {
  const db = getD1();
  await db
    .prepare(
      `UPDATE orders
       SET status = 'failed', payment_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND payment_provider = ? AND status = 'pending'`,
    )
    .bind(paymentId || null, orderId, provider)
    .run();
  // The order never paid, so any loyalty points it reserved at checkout
  // were never actually earned back yet - give them back to the customer.
  try {
    await refundRedeemedPoints(db, orderId);
  } catch {
    // Never let a loyalty bookkeeping hiccup mask the payment failure itself.
  }
}

export async function markOrderPaid(input: {
  orderId: string;
  provider: PaymentProviderId;
  paymentId: string;
}) {
  const db = getD1();
  await ensureLoyaltyColumns(db);
  const order = await readPaymentOrder(input.orderId);
  if (!order || order.payment_provider !== input.provider) {
    throw new Error("Sipariş bulunamadı.");
  }
  if (["paid", "shipped", "delivered"].includes(order.status)) {
    if (order.payment_id && order.payment_id !== input.paymentId) {
      throw new Error("Sipariş için farklı bir ödeme kaydı mevcut.");
    }
    return;
  }
  if (order.status === "cancelled") {
    throw new Error("Sipariş durumu ödemeye uygun değil.");
  }

  // Guest orders (no account) have nothing to credit. Based on
  // total_amount, which is already net of any loyalty discount this same
  // order redeemed - can't earn points on points you just spent.
  const pointsEarned = order.user_id ? computePointsEarned(order.total_amount) : 0;

  const items = await db
    .prepare(
      `SELECT product_id, quantity FROM order_items
       WHERE order_id = ? AND product_id IS NOT NULL`,
    )
    .bind(input.orderId)
    .all<{ product_id: number; quantity: number }>();

  await db.batch([
    ...items.results.map((item) =>
      db
        .prepare(
          `UPDATE products
           SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND EXISTS (
               SELECT 1 FROM orders
               WHERE id = ?
                 AND payment_provider = ?
                 AND status IN ('pending', 'failed')
             )`,
        )
        .bind(
          item.quantity,
          item.quantity,
          item.product_id,
          input.orderId,
          input.provider,
        ),
    ),
    db
      .prepare(
        `UPDATE discount_codes
         SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE code = (
           SELECT discount_code FROM orders
           WHERE id = ? AND payment_provider = ?
             AND status IN ('pending', 'failed')
         )`,
      )
      .bind(input.orderId, input.provider),
    // Must stay before the status-changing statement below - both this
    // and the stock/discount updates above rely on seeing the order still
    // in ('pending', 'failed') to guard against ever running twice.
    ...(order.user_id && pointsEarned > 0
      ? [
          db
            .prepare(
              `UPDATE users SET loyalty_points = loyalty_points + ?
               WHERE id = ? AND EXISTS (
                 SELECT 1 FROM orders
                 WHERE id = ? AND payment_provider = ?
                   AND status IN ('pending', 'failed')
               )`,
            )
            .bind(pointsEarned, order.user_id, input.orderId, input.provider),
          db
            .prepare(
              `UPDATE orders SET loyalty_points_earned = ?, loyalty_status = 'earned'
               WHERE id = ? AND payment_provider = ?
                 AND status IN ('pending', 'failed')`,
            )
            .bind(pointsEarned, input.orderId, input.provider),
        ]
      : []),
    db
      .prepare(
        `UPDATE orders
         SET status = 'paid', payment_id = ?, paid_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND payment_provider = ?
           AND status IN ('pending', 'failed')`,
      )
      .bind(input.paymentId, input.orderId, input.provider),
  ]);

  // D1 is the source of truth for stock (see lib/shopify/inventory.ts) -
  // push each affected product's new count to Shopify so it can't oversell
  // an item that was just sold here. Never let a Shopify hiccup fail the
  // payment confirmation the customer is waiting on.
  for (const item of items.results) {
    try {
      await pushInventoryToShopify(db, item.product_id);
    } catch {
      // Self-heals on the next stock change or scheduled sync.
    }
  }
}
