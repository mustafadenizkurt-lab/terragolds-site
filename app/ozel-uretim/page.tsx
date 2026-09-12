import type { Metadata } from "next";
import { readSettings } from "../../lib/store-db";
import {
  ensureCustomOrderGalleryTable,
  readCustomOrderGallery,
} from "../../lib/custom-order-gallery";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import CustomOrderForm from "./custom-order-form";
import CustomOrderPageBody from "./custom-order-page-body";

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

      <CustomOrderPageBody galleryItems={galleryItems} />

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
