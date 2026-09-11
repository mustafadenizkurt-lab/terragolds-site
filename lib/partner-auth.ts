import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCustomerFromRequest } from "./customer-auth";
import { ensurePartnerColumns } from "./partner-referral";
import { getD1 } from "./store-db";

export type AuthorizedPartner = {
  id: number;
  displayName: string;
  email: string;
  referralCode: string | null;
  commissionRate: number;
};

type PartnerAccountLookup =
  | { found: false }
  | { found: true; isActive: false; displayName: string }
  | { found: true; isActive: true; partner: AuthorizedPartner };

async function lookupPartnerAccount(authRequest: Request): Promise<PartnerAccountLookup> {
  const customer = await getCustomerFromRequest(authRequest);
  if (!customer) return { found: false };

  const db = getD1();
  await ensurePartnerColumns(db);
  const row = await db
    .prepare(
      "SELECT role, is_active AS isActive, referral_code AS referralCode, commission_rate AS commissionRate FROM users WHERE id = ? LIMIT 1",
    )
    .bind(customer.id)
    .first<{
      role: string;
      isActive: number;
      referralCode: string | null;
      commissionRate: number | null;
    }>();
  if (row?.role !== "partner") return { found: false };

  const displayName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
  if (!row.isActive) return { found: true, isActive: false, displayName };

  return {
    found: true,
    isActive: true,
    partner: {
      id: customer.id,
      displayName,
      email: customer.email,
      referralCode: row.referralCode,
      commissionRate: row.commissionRate ?? 0,
    },
  };
}

// Used by every partner-facing API route: returns null for anyone who
// isn't an active partner (not logged in, not a partner, or deactivated) -
// callers never need their own separate is_active check.
export async function getAuthorizedPartner(
  request?: Request,
): Promise<AuthorizedPartner | null> {
  const authRequest =
    request ??
    new Request("https://terragolds.local/partner", {
      headers: await headers(),
    });
  const result = await lookupPartnerAccount(authRequest);
  return result.found && result.isActive ? result.partner : null;
}

export type RequirePartnerResult =
  | { status: "active"; partner: AuthorizedPartner }
  | { status: "inactive"; displayName: string };

// For the /partner page only. A deactivated partner still has a working
// login (their account is real) - bouncing them to /login would look like
// a broken password, so this returns an explicit "inactive" status instead
// of redirecting, letting the page render a proper "hesabınız pasif"
// notice. Only a genuinely unauthenticated or non-partner visitor is
// redirected to /login.
export async function requireAuthorizedPartner(
  returnTo = "/partner",
): Promise<RequirePartnerResult> {
  const authRequest = new Request("https://terragolds.local/partner", {
    headers: await headers(),
  });
  const result = await lookupPartnerAccount(authRequest);
  if (!result.found) {
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }
  if (!result.isActive) return { status: "inactive", displayName: result.displayName };
  return { status: "active", partner: result.partner };
}

export function unauthorizedPartnerResponse() {
  return Response.json(
    { error: "Bu işlem için iş ortağı girişi gerekli." },
    { status: 401 },
  );
}
