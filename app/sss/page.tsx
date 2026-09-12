import type { Metadata } from "next";
import { readSettings } from "../../lib/store-db";
import { breadcrumbSchema, toJsonLd, SITE_URL } from "../../lib/seo/structured-data";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import StoreTrustBar from "../store-trust-bar";
import FaqPageBody from "./faq-page-body";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular | Terragolds",
  description:
    "Terragolds'ta kargo, iade, ödeme, özel üretim ve ürünler hakkında sık sorulan soruların cevapları.",
  alternates: { canonical: `${SITE_URL}/sss` },
};

export default async function FaqPage() {
  const settings = await readSettings();
  const address = [settings.address, settings.district, settings.city]
    .filter(Boolean)
    .join(", ");

  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Sıkça Sorulan Sorular", url: `${SITE_URL}/sss` },
  ]);

  return (
    <main className="faq-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <StoreTrustBar />

      <FaqPageBody settings={settings} address={address} />

      <StoreSiteFooter
        businessName={settings.businessName}
        address={address}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
        email={settings.email}
        instagram={settings.instagram}
        facebook={settings.facebook}
        tiktok={settings.tiktok}
      />
      <FloatingSocialLinks />
    </main>
  );
}
