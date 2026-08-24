import type { Metadata } from "next";
import PaymentResultClient from "./payment-result-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ödeme Sonucu | Terragolds",
  robots: { index: false, follow: false },
};

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; orderId?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "success" || params.status === "pending"
      ? params.status
      : "failed";
  const orderId = String(params.orderId ?? "").slice(0, 80);
  return <PaymentResultClient status={status} orderId={orderId} />;
}
