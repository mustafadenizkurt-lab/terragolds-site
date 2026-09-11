import type { Metadata } from "next";
import { requireAuthorizedPartner } from "../../lib/partner-auth";
import PartnerClient from "./partner-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İş Ortağı Paneli | Terragolds",
  robots: { index: false, follow: false },
};

export default async function PartnerPage() {
  const result = await requireAuthorizedPartner("/partner");

  if (result.status === "inactive") {
    return (
      <main className="profile-page">
        <section className="profile-content">
          <div className="profile-title">
            <p>İş ortağı paneli</p>
            <h1>Hoş geldin, {result.displayName}</h1>
          </div>
          <div className="admin-inline-error" role="alert" style={{ maxWidth: 720, margin: "0 auto" }}>
            Hesabınız şu anda pasif durumda. Erişiminizin yeniden açılması için lütfen yönetici ile iletişime geçin.
          </div>
        </section>
      </main>
    );
  }

  const partner = result.partner;
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
