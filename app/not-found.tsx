import type { Metadata } from "next";
import { readSettings } from "../lib/store-db";
import { FloatingSocialLinks } from "./store-shared-chrome";
import StoreSiteFooter from "./store-site-footer";
import StoreSubpageHeader from "./store-subpage-header";
import NotFoundBody from "./not-found-body";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı | Terragolds",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const settings = await readSettings().catch(() => null);

  return (
    <main className="category-page">
      <StoreSubpageHeader />
      <NotFoundBody />
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
