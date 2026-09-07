import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../lib/store-db";
import { FloatingSocialLinks } from "./store-shared-chrome";
import StoreSiteFooter from "./store-site-footer";
import StoreSubpageHeader from "./store-subpage-header";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | Terragolds",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const settings = await readSettings().catch(() => null);

  return (
    <main className="category-page">
      <StoreSubpageHeader />
      <section className="category-hero section-shell">
        <p className="eyebrow">404</p>
        <h1>Aradığınız sayfa bulunamadı</h1>
        <p>
          Bağlantı eski olabilir veya ürün artık satışta olmayabilir.
          Aşağıdaki bağlantılarla devam edebilirsiniz.
        </p>
      </section>
      <section className="category-products section-shell not-found-actions">
        <Link className="button button-dark" href="/">
          Ana Sayfaya Dön
        </Link>
        <Link className="button button-light" href="/#shop">
          Tüm Ürünler
        </Link>
        <Link className="button button-light" href="/sss">
          Sıkça Sorulan Sorular
        </Link>
        <Link className="button button-light" href="/support">
          Destek
        </Link>
      </section>
      {settings && (
        <StoreSiteFooter
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
      )}
      <FloatingSocialLinks />
    </main>
  );
}
