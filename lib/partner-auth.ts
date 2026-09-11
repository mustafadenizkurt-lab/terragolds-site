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

export async function getAuthorizedPartner(
  request?: Request,
): Promise<AuthorizedPartner | null> {
  const authRequest =
    request ??
    new Request("https://terragolds.local/partner", {
      headers: await headers(),
    });
  const customer = await getCustomerFromRequest(authRequest);
  if (!customer) return null;

  const db = getD1();
  await ensurePartnerColumns(db);
  const row = await db
    .prepare(
      "SELECT role, referral_code AS referralCode, commission_rate AS commissionRate FROM users WHERE id = ? LIMIT 1",
    )
    .bind(customer.id)
    .first<{ role: string; referralCode: string | null; commissionRate: number | null }>();
  if (row?.role !== "partner") return null;

  return {
    id: customer.id,
    displayName: `${customer.firstName} ${customer.lastName}`.trim() || customer.email,
    email: customer.email,
    referralCode: row.referralCode,
    commissionRate: row.commissionRate ?? 0,
  };
}

export async function requireAuthorizedPartner(returnTo = "/partner") {
  const partner = await getAuthorizedPartner();
  if (partner) return partner;

  redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
}

export function unauthorizedPartnerResponse() {
  return Response.json(
    { error: "Bu işlem için iş ortağı girişi gerekli." },
    { status: 401 },
  );
}
