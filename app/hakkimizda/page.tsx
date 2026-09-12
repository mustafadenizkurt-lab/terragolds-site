import type { Metadata } from "next";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import AboutPageBody from "./about-page-body";
import {
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Hakkımızda | Terragolds",
  description: "Terragolds takı koleksiyonu, seçim ve paketleme yaklaşımı.",
  alternates: { canonical: "https://www.terragolds.com/hakkimizda" },
};

export default async function AboutPage() {
  const settings = await readSettings();
  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Hakkımızda", url: `${SITE_URL}/hakkimizda` },
  ]);

  return (
    <main className="about-page market-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <AboutPageBody
        businessName={settings.businessName}
        email={settings.email}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
      />
      <StoreSiteFooter
        footerNote={settings.footerNote}
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
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
