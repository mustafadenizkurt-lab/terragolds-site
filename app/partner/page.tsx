import type { Metadata } from "next";
import { requireAuthorizedPartner } from "../../lib/partner-auth";
import PartnerClient from "./partner-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İş Ortağı Paneli | Terragolds",
  robots: { index: false, follow: false },
};

export default async function PartnerPage() {
  const partner = await requireAuthorizedPartner("/partner");
  return (
    <PartnerClient
      partner={{
        name: partner.displayName,
        email: partner.email,
        referralCode: partner.referralCode ?? "",
      }}
    />
  );
}
