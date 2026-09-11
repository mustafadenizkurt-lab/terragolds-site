// Terragolds Puan programı: her ödenmiş TL karşılığı puan kazanılır, puanlar
// sonraki bir siparişte indirim olarak kullanılabilir. Kazanım ve harcama
// aynı oranı paylaşır (1 puan = 10 kuruş), yani puanları tam harcarsanız
// harcadığınız kadarını geri almış olursunuz - %1 etkin puan iadesi gibi.
export const EARN_KURUS_PER_POINT = 1000; // 10 TL harcamada 1 puan
export const REDEEM_KURUS_PER_POINT = 10; // 1 puan = 0,10 TL indirim

export function computePointsEarned(totalAmountKurus: number): number {
  return Math.max(0, Math.floor(totalAmountKurus / EARN_KURUS_PER_POINT));
}

export function computeRedemptionDiscount(points: number): number {
  return Math.max(0, points) * REDEEM_KURUS_PER_POINT;
}

// D1's actual deploy pipeline here never runs `wrangler d1 migrations
// apply` - only `wrangler deploy` for the Worker bundle - so new columns
// are added lazily at runtime (same pattern as e.g. partner-referral.ts).
export async function ensureLoyaltyColumns(db: D1Database) {
  const userColumns = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const userNames = new Set(userColumns.results.map((column) => column.name));
  if (!userNames.has("loyalty_points")) {
    await db.prepare("ALTER TABLE users ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0").run();
  }

  const orderColumns = await db.prepare("PRAGMA table_info(orders)").all<{ name: string }>();
  const orderNames = new Set(orderColumns.results.map((column) => column.name));
  if (!orderNames.has("loyalty_points_earned")) {
    await db.prepare("ALTER TABLE orders ADD COLUMN loyalty_points_earned INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!orderNames.has("loyalty_points_redeemed")) {
    await db.prepare("ALTER TABLE orders ADD COLUMN loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!orderNames.has("loyalty_discount_amount")) {
    await db.prepare("ALTER TABLE orders ADD COLUMN loyalty_discount_amount INTEGER NOT NULL DEFAULT 0").run();
  }
  if (!orderNames.has("loyalty_status")) {
    // 'none' (no points earned yet / not applicable), 'earned' (credited to
    // the customer's balance), 'reversed' (clawed back after a refund or
    // order cancellation). Mirrors partner-referral.ts's commission_status.
    await db.prepare("ALTER TABLE orders ADD COLUMN loyalty_status TEXT NOT NULL DEFAULT 'none'").run();
  }
  if (!orderNames.has("loyalty_redeem_refunded")) {
    await db.prepare("ALTER TABLE orders ADD COLUMN loyalty_redeem_refunded INTEGER NOT NULL DEFAULT 0").run();
  }
}

export async function getLoyaltyBalance(db: D1Database, userId: number): Promise<number> {
  await ensureLoyaltyColumns(db);
  const row = await db
    .prepare("SELECT loyalty_points AS points FROM users WHERE id = ?")
    .bind(userId)
    .first<{ points: number }>();
  return row?.points ?? 0;
}

// Atomic check-and-deduct in a single statement, so two simultaneous
// checkouts for the same account can never both succeed in spending the
// same points twice. Returns how many points were actually reserved (may
// be less than requested, or 0, if the balance changed underneath us -
// the caller should use this return value, not the original request, for
// the discount it actually grants).
export async function reserveRedemption(
  db: D1Database,
  userId: number,
  requestedPoints: number,
): Promise<number> {
  await ensureLoyaltyColumns(db);
  const points = Math.max(0, Math.floor(requestedPoints));
  if (points <= 0) return 0;
  const result = await db
    .prepare("UPDATE users SET loyalty_points = loyalty_points - ? WHERE id = ? AND loyalty_points >= ?")
    .bind(points, userId, points)
    .run();
  return result.meta.changes > 0 ? points : 0;
}

// Called when a redeeming order never gets paid (see markOrderFailed) -
// gives the reserved points back. Guarded by loyalty_redeem_refunded so it
// can never double-refund the same order.
export async function refundRedeemedPoints(db: D1Database, orderId: string): Promise<void> {
  await ensureLoyaltyColumns(db);
  const order = await db
    .prepare(
      `SELECT user_id AS userId, loyalty_points_redeemed AS redeemed
       FROM orders WHERE id = ? AND loyalty_points_redeemed > 0 AND loyalty_redeem_refunded = 0`,
    )
    .bind(orderId)
    .first<{ userId: number | null; redeemed: number }>();
  if (!order || !order.userId) return;

  await db.batch([
    db
      .prepare("UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?")
      .bind(order.redeemed, order.userId),
    db
      .prepare("UPDATE orders SET loyalty_redeem_refunded = 1 WHERE id = ?")
      .bind(orderId),
  ]);
}

// Called when a paid order is refunded (return_requests reaching
// 'completed') or an admin cancels an already-paid order - claws back the
// points that order had credited. Never restores redeemed points (the
// customer already got that discount's benefit). A no-op if this order
// never earned points or was already reversed, so always safe to call
// speculatively.
export async function reverseEarnedPoints(db: D1Database, orderId: string): Promise<void> {
  await ensureLoyaltyColumns(db);
  const order = await db
    .prepare(
      `SELECT user_id AS userId, loyalty_points_earned AS earned
       FROM orders WHERE id = ? AND loyalty_status = 'earned'`,
    )
    .bind(orderId)
    .first<{ userId: number | null; earned: number }>();
  if (!order || !order.userId || order.earned <= 0) {
    // Still flip the status even with nothing to claw back, so a retry
    // (e.g. re-saving a return request) doesn't keep re-querying this order.
    await db
      .prepare("UPDATE orders SET loyalty_status = 'reversed' WHERE id = ? AND loyalty_status = 'earned'")
      .bind(orderId)
      .run();
    return;
  }

  await db.batch([
    db
      // Floored at 0 - the customer may have already spent these points
      // elsewhere, and a loyalty balance never goes negative for that.
      .prepare("UPDATE users SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?")
      .bind(order.earned, order.userId),
    db
      .prepare("UPDATE orders SET loyalty_status = 'reversed' WHERE id = ? AND loyalty_status = 'earned'")
      .bind(orderId),
  ]);
}
