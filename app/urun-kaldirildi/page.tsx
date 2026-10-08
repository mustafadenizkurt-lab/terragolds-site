import type { Metadata } from "next";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import ProductRemovedBody from "./product-removed-body";

// worker/index.ts, /products/:slug 404 verip hiçbir yönlendirme bulamayınca
// bu sayfayı dahili olarak çağırıp (handler.fetch) durum kodunu 410'a
// çeviriyor - bu dosya kendisi hiçbir zaman 200 ile ziyaret edilmemeli,
// bu yüzden indexlenmesin.
export const metadata: Metadata = {
  title: "Ürün Artık Mevcut Değil",
  robots: { index: false, follow: true },
};

export default async function ProductRemovedPage() {
  const settings = await readSettings().catch(() => null);

  return (
    <main className="category-page">
      <StoreSubpageHeader />
      <ProductRemovedBody />
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
