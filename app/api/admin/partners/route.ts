import { hash } from "bcryptjs";
import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../lib/admin-auth";
import { normalizeCustomerName } from "../../../../lib/customer-name";
import {
  COMMISSION_ELIGIBLE_STATUSES,
  ensurePartnerColumns,
  generateUniqueReferralCode,
} from "../../../../lib/partner-referral";
import { getD1 } from "../../../../lib/store-db";
import { sendTransactionalEmail } from "../../../../lib/transactional-email";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const eligibleStatusList = COMMISSION_ELIGIBLE_STATUSES.map((status) => `'${status}'`).join(", ");

type PartnerRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  referralCode: string | null;
  commissionRate: number | null;
  isActive: number;
  createdAt: string;
  customerCount: number;
  orderCount: number;
  revenue: number;
  commissionTotal: number;
  payoutTotal: number;
};

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const db = getD1();
    await ensurePartnerColumns(db);
    const partners = await db
      .prepare(
        `SELECT
            partner.id AS id,
            partner.first_name AS firstName,
            partner.last_name AS lastName,
            partner.email AS email,
            partner.referral_code AS referralCode,
            partner.commission_rate AS commissionRate,
            partner.is_active AS isActive,
            partner.created_at AS createdAt,
            (SELECT COUNT(*) FROM users customer WHERE customer.referred_by = partner.id) AS customerCount,
            COUNT(orders.id) AS orderCount,
            COALESCE(SUM(CASE WHEN orders.status IN (${eligibleStatusList}) THEN orders.total_amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN orders.status IN (${eligibleStatusList}) AND orders.commission_status = 'earned' THEN orders.commission_amount ELSE 0 END), 0) AS commissionTotal,
            (SELECT COALESCE(SUM(amount), 0) FROM partner_payouts WHERE partner_payouts.partner_id = partner.id) AS payoutTotal
          FROM users partner
          LEFT JOIN orders ON orders.referred_by_partner_id = partner.id
          WHERE partner.role = 'partner'
          GROUP BY partner.id
          ORDER BY datetime(partner.created_at) DESC`,
      )
      .all<PartnerRow>();

    return Response.json({ partners: partners.results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Partner listesi alınamadı." },
      { status: 500 },
    );
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const firstName = normalizeCustomerName(body.firstName);
    const lastName = normalizeCustomerName(body.lastName);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 190);
    const commissionRate = Number(body.commissionRate);

    if (!firstName || !lastName || !emailPattern.test(email)) {
      return Response.json(
        { error: "Ad, soyad ve geçerli bir e-posta adresi gereklidir." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      return Response.json(
        { error: "Komisyon oranı 0 ile 100 arasında bir sayı olmalıdır." },
        { status: 400 },
      );
    }

    const db = getD1();
    await ensurePartnerColumns(db);

    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (existing) {
      return Response.json(
        { error: "Bu e-posta adresiyle zaten bir hesap var." },
        { status: 409 },
      );
    }

    const referralCode = await generateUniqueReferralCode(db);
    // Unusable placeholder - the partner sets their real password via the
    // invite link below (the exact same set-password flow as
    // /reset-password) before they can ever log in.
    const placeholderPasswordHash = await hash(
      bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      12,
    );

    const created = await db
      .prepare(
        `INSERT INTO users
          (first_name, last_name, email, password_hash, role, referral_code, commission_rate, updated_at)
         VALUES (?, ?, ?, ?, 'partner', ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`,
      )
      .bind(firstName, lastName, email, placeholderPasswordHash, referralCode, commissionRate)
      .first<{ id: number }>();
    if (!created) throw new Error("Partner oluşturulamadı.");

    const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
      )
      .bind(created.id, tokenHash, expiresAt)
      .run();

    const setPasswordUrl = new URL("/reset-password", new URL(request.url).origin);
    setPasswordUrl.searchParams.set("token", token);
    const safeUrl = escapeHtml(setPasswordUrl.toString());

    try {
      await sendTransactionalEmail({
        to: email,
        subject: "Terragolds iş ortağı davetiniz",
        idempotencyKey: `partner-invite-${tokenHash}`,
        html: `<div style="font-family:Arial,sans-serif;color:#122e27;line-height:1.6">
          <h1 style="font-family:Georgia,serif;font-weight:400">Terragolds iş ortağı programına hoş geldiniz</h1>
          <p>Merhaba ${escapeHtml(firstName)}, Terragolds için bir iş ortağı hesabı oluşturuldu. Referans kodunuz: <strong>${escapeHtml(referralCode)}</strong></p>
          <p>Hesabınıza giriş yapabilmek için önce bir şifre belirlemeniz gerekiyor.</p>
          <p><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;background:#123b31;color:#fff;text-decoration:none">Şifreni belirle</a></p>
          <p>Bu bağlantı 7 gün boyunca ve yalnızca bir kez kullanılabilir.</p>
        </div>`,
        text: `Terragolds iş ortağı hesabınız oluşturuldu. Referans kodunuz: ${referralCode}\n\nŞifrenizi belirlemek için bağlantıyı açın: ${setPasswordUrl.toString()}\n\nBağlantı 7 gün boyunca ve yalnızca bir kez kullanılabilir.`,
      });
    } catch (emailError) {
      return Response.json({
        id: created.id,
        referralCode,
        warning:
          "Partner oluşturuldu ama davet e-postası gönderilemedi: " +
          (emailError instanceof Error ? emailError.message : "bilinmeyen hata"),
        devSetPasswordUrl: setPasswordUrl.toString(),
      });
    }

    return Response.json({ id: created.id, referralCode });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Partner oluşturulamadı." },
      { status: 500 },
    );
  }
}
