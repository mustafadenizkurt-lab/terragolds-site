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
};

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
): Promise<CheckoutPartnerAttribution | null> {
  await ensurePartnerColumns(db);

  const refCode = readCookieValue(request, REFERRAL_COOKIE);
  if (refCode) {
    const partner = await db
      .prepare(
        "SELECT id, commission_rate AS commissionRate FROM users WHERE role = 'partner' AND referral_code = ? LIMIT 1",
      )
      .bind(refCode)
      .first<{ id: number; commissionRate: number | null }>();
    if (partner) {
      return { partnerId: partner.id, commissionRate: partner.commissionRate ?? 0 };
    }
  }

  if (customerId) {
    const row = await db
      .prepare(
        `SELECT partner.id AS id, partner.commission_rate AS commissionRate
         FROM users customer
         JOIN users partner ON partner.id = customer.referred_by AND partner.role = 'partner'
         WHERE customer.id = ?`,
      )
      .bind(customerId)
      .first<{ id: number; commissionRate: number | null }>();
    if (row) return { partnerId: row.id, commissionRate: row.commissionRate ?? 0 };
  }

  return null;
}
