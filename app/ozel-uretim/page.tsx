import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import {
  ensureCustomOrderGalleryTable,
  readCustomOrderGallery,
} from "../../lib/custom-order-gallery";
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
  await ensureCustomOrderGalleryTable();
  const [settings, galleryItems] = await Promise.all([
    readSettings(),
    readCustomOrderGallery(),
  ]);
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

      {galleryItems.length > 0 && (
        <section className="custom-order-gallery-section section-shell">
          <div className="market-section-title">
            <span aria-hidden="true">✦</span>
            <div>
              <small>Geçmiş işlerimiz</small>
              <h2>Örnek Çalışmalarımız</h2>
            </div>
          </div>
          <div className="custom-order-gallery-grid">
            {galleryItems.map((item) => (
              <figure className="custom-order-gallery-card" key={item.id}>
                <img src={item.imageUrl} alt={item.title || "Özel üretim çalışması"} loading="lazy" />
                {(item.title || item.description) && (
                  <figcaption>
                    {item.title && <strong>{item.title}</strong>}
                    {item.description && <span>{item.description}</span>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

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
