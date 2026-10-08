import type { Metadata } from "next";
import { readSettings, readCustomProductionPhotos } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import CustomProductionBody from "./custom-production-body";
import {
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Özel Üretim",
  description:
    "Hayalinizdeki takıyı birlikte tasarlayalım. Adınızı ve telefon numaranızı bırakın, WhatsApp üzerinden size özel üretim süreci hakkında dönüş yapalım.",
  alternates: { canonical: "https://www.terragolds.com/ozel-uretim" },
};

export default async function CustomProductionPage() {
  const [settings, photos] = await Promise.all([
    readSettings(),
    readCustomProductionPhotos().catch(() => []),
  ]);
  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Özel Üretim", url: `${SITE_URL}/ozel-uretim` },
  ]);

  return (
    <main className="about-page market-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <CustomProductionBody whatsapp={settings.whatsapp} photos={photos} />
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
