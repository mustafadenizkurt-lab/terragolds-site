import type { Metadata } from "next";
import FavoritesClient from "./favorites-client";
import { FloatingSocialLinks } from "../store-shared-chrome";
import { readSettings } from "../../lib/store-db";

export const metadata: Metadata = {
  title: "Favorilerim | Terragolds",
  description: "Beğendiğiniz Terragolds doğal taşlarını tek yerde inceleyin.",
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const settings = await readSettings();
  return (
    <>
      <FavoritesClient
        businessName={settings.businessName}
        businessAddress={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
      />
      <FloatingSocialLinks />
    </>
  );
}
