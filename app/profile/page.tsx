import type { Metadata } from "next";
import ProfileClient from "./profile-client";
import { readSettings } from "../../lib/store-db";

export const metadata: Metadata = {
  title: "Profilim | Terragolds",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const settings = await readSettings();
  return (
    <ProfileClient
      businessName={settings.businessName}
      businessAddress={[settings.address, settings.district, settings.city]
        .filter(Boolean)
        .join(", ")}
    />
  );
}
