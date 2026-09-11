import type { Metadata } from "next";
import CompareClient from "./compare-client";
import { FloatingSocialLinks } from "../store-shared-chrome";
import { readSettings } from "../../lib/store-db";

export const metadata: Metadata = {
  title: "Ürün Karşılaştır | Terragolds",
  description: "Seçtiğiniz Terragolds ürünlerini yan yana karşılaştırın.",
  robots: { index: false, follow: false },
};

export default async function ComparePage() {
  const settings = await readSettings();
  return (
    <>
      <CompareClient
        businessName={settings.businessName}
        businessAddress={[settings.address, settings.district, settings.city]
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
    </>
  );
}
