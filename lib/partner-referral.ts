export const REFERRAL_COOKIE = "tg_ref";

// D1's actual deploy pipeline here never runs `wrangler d1 migrations
// apply` - only `wrangler deploy` for the Worker bundle - so a
// drizzle-kit migration file would silently never reach production. New
// columns are added lazily at runtime instead (same pattern already used
// for e.g. orders.vat_amount and products.shopify_price_synced).
export async function ensurePartnerColumns(db: D1Database) {
  const userColumns = await db
    .prepare("PRAGMA table_info(users)")
    .all<{ name: string }>();
  const userNames = new Set(userColumns.results.map((column) => column.name));
  if (!userNames.has("referral_code")) {
    await db.prepare("ALTER TABLE users ADD COLUMN referral_code TEXT").run();
  }
  if (!userNames.has("commission_rate")) {
    await db.prepare("ALTER TABLE users ADD COLUMN commission_rate REAL").run();
  }
  if (!userNames.has("referred_by")) {
    await db.prepare("ALTER TABLE users ADD COLUMN referred_by INTEGER").run();
  }
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users(referral_code)",
    )
    .run();

  const orderColumns = await db
    .prepare("PRAGMA table_info(orders)")
    .all<{ name: string }>();
  const orderNames = new Set(orderColumns.results.map((column) => column.name));
  if (!orderNames.has("referred_by_partner_id")) {
    await db
      .prepare("ALTER TABLE orders ADD COLUMN referred_by_partner_id INTEGER")
      .run();
  }
  if (!orderNames.has("commission_rate_snapshot")) {
    await db
      .prepare("ALTER TABLE orders ADD COLUMN commission_rate_snapshot REAL")
      .run();
  }
  if (!orderNames.has("commission_amount")) {
    await db
      .prepare(
        "ALTER TABLE orders ADD COLUMN commission_amount INTEGER NOT NULL DEFAULT 0",
      )
      .run();
  }
  if (!orderNames.has("commission_status")) {
    // SQLite backfills a static ALTER TABLE ... DEFAULT onto every existing
    // row too, so every order placed before this column existed correctly
    // starts out 'earned' rather than NULL.
    await db
      .prepare(
        "ALTER TABLE orders ADD COLUMN commission_status TEXT NOT NULL DEFAULT 'earned'",
      )
      .run();
  }
}

// Orders count a partner's commission only once payment has actually gone
// through - a pending/failed/cancelled order was never really "earned".
export const COMMISSION_ELIGIBLE_STATUSES = ["paid", "shipped", "delivered"] as const;

const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const byte of bytes) {
    code += REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueReferralCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomReferralCode();
    const existing = await db
      .prepare("SELECT id FROM users WHERE referral_code = ?")
      .bind(code)
      .first<{ id: number }>();
    if (!existing) return code;
  }
  throw new Error("Referans kodu üretilemedi, tekrar deneyin.");
}

export function readCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

// A brand new account's referred_by is always NULL, so this can only ever
// set it once - matching the "ilk kazanan kalır" rule: an existing
// customer who later browses with a different partner's ?ref= link never
// has their home partner reassigned.
export async function attributeNewCustomerReferral(
  db: D1Database,
  newUserId: number,
  request: Request,
): Promise<void> {
  await ensurePartnerColumns(db);
  const refCode = readCookieValue(request, REFERRAL_COOKIE);
  if (!refCode) return;
  const partner = await db
    .prepare("SELECT id FROM users WHERE role = 'partner' AND referral_code = ? LIMIT 1")
    .bind(refCode)
    .first<{ id: number }>();
  if (!partner) return;
  await db
    .prepare("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL")
    .bind(partner.id, newUserId)
    .run();
}

export type CheckoutPartnerAttribution = {
  partnerId: number;
  commissionRate: number;
  // True when the order being placed is the partner's own purchase (their
  // account id matches the logged-in customer, or the order's email matches
  // their partner account's email). referred_by_partner_id/commission_rate_
  // snapshot are still recorded for transparency, but the caller must treat
  // commission_amount as 0 - a partner never earns commission on themselves.
  isSelfReferral: boolean;
};

function toAttribution(
  partner: { id: number; commissionRate: number | null; email: string },
  customerId: number | null,
  orderEmail: string,
): CheckoutPartnerAttribution {
  return {
    partnerId: partner.id,
    commissionRate: partner.commissionRate ?? 0,
    isSelfReferral:
      partner.id === customerId ||
      partner.email.trim().toLowerCase() === orderEmail.trim().toLowerCase(),
  };
}

// Resolves which partner (if any) this specific order should be attributed
// to: a fresh ?ref= cookie wins first (covers guest checkout and a
// logged-in customer deliberately following a different partner's link for
// this purchase); otherwise, a logged-in customer falls back to their
// account's permanent home partner (users.referred_by) so a partner keeps
// earning on repeat purchases even without a fresh link each time.
export async function resolveCheckoutPartner(
  db: D1Database,
  request: Request,
  customerId: number | null,
  orderEmail: string,
): Promise<CheckoutPartnerAttribution | null> {
  await ensurePartnerColumns(db);

  const refCode = readCookieValue(request, REFERRAL_COOKIE);
  if (refCode) {
    const partner = await db
      .prepare(
        "SELECT id, commission_rate AS commissionRate, email FROM users WHERE role = 'partner' AND referral_code = ? LIMIT 1",
      )
      .bind(refCode)
      .first<{ id: number; commissionRate: number | null; email: string }>();
    if (partner) return toAttribution(partner, customerId, orderEmail);
  }

  if (customerId) {
    const row = await db
      .prepare(
        `SELECT partner.id AS id, partner.commission_rate AS commissionRate, partner.email AS email
         FROM users customer
         JOIN users partner ON partner.id = customer.referred_by AND partner.role = 'partner'
         WHERE customer.id = ?`,
      )
      .bind(customerId)
      .first<{ id: number; commissionRate: number | null; email: string }>();
    if (row) return toAttribution(row, customerId, orderEmail);
  }

  return null;
}

// Called when a refund is confirmed for an order (see return-requests'
// PATCH route) - flips its commission from 'earned' to 'reversed' so a
// partner's total no longer includes it, without deleting or zeroing the
// original row (kept for audit trail). A no-op (0 rows changed) if orderId
// doesn't match a real order or was never 'earned' to begin with, so this
// is always safe to call speculatively.
export async function reverseCommissionForOrder(
  db: D1Database,
  orderId: string,
): Promise<void> {
  await ensurePartnerColumns(db);
  await db
    .prepare(
      "UPDATE orders SET commission_status = 'reversed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND commission_status = 'earned'",
    )
    .bind(orderId)
    .run();
}
