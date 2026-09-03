import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import CustomOrderForm from "./custom-order-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Özel Üretim | Terragolds",
  description:
    "Hayalinizdeki tasarımı bizimle paylaşın, sizin için özel üretelim. Taş, model ve ölçü tercihlerinizi birlikte belirleyelim.",
  alternates: { canonical: "https://www.terragolds.com/ozel-uretim" },
};

export default async function CustomOrderPage() {
  const settings = await readSettings();
  return (
    <main className="custom-order-page">
      <StoreSubpageHeader />

      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span>/</span>
          <b>Özel Üretim</b>
        </div>
        <p className="eyebrow">Kişiye özel</p>
        <h1>Özel Üretim</h1>
        <p>
          Hayalinizdeki tasarımı bizimle paylaşın, sizin için özel üretelim.
          Taş, model ve ölçü tercihlerinizi birlikte belirleyelim; size özgü,
          tek parça bir eser hazırlayalım.
        </p>
      </section>

      <CustomOrderForm whatsapp={settings.whatsapp} phone={settings.phone} />

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
