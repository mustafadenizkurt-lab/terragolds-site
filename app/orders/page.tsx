import type { Metadata } from "next";
import OrdersClient from "./orders-client";
import { readSettings } from "../../lib/store-db";

export const metadata: Metadata = {
  title: "Siparişlerim | Terragolds",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const settings = await readSettings();
  return (
    <OrdersClient
      businessName={settings.businessName}
      businessAddress={[settings.address, settings.district, settings.city]
        .filter(Boolean)
        .join(", ")}
    />
  );
}
