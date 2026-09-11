"use client";

import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";

type DashboardData = {
  referralCode: string | null;
  commissionRate: number;
  customerCount: number;
  orderCount: number;
  revenue: number;
  commissionTotal: number;
  payoutTotal: number;
  pendingTotal: number;
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export default function PartnerClient({
  partner,
}: {
  partner: { name: string; email: string; referralCode: string };
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/partner/dashboard", { cache: "no-store" });
        const body = (await response.json()) as DashboardData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Panel verileri alınamadı.");
        setData(body);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Panel verileri alınamadı.");
      }
    })();
  }, []);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${partner.referralCode}`
      : `https://www.terragolds.com/?ref=${partner.referralCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Bağlantı kopyalanamadı, elle seçip kopyalayabilirsiniz.");
    }
  };

  return (
    <main className="profile-page">
      <StoreSubpageHeader />
      <section className="profile-content">
        <div className="profile-title">
          <p>İş ortağı paneli</p>
          <h1>Hoş geldin, {partner.name}</h1>
        </div>

        <div className="admin-panel" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="admin-panel-heading">
            <div>
              <p className="admin-kicker">Referans linkiniz</p>
              <h2 style={{ wordBreak: "break-all" }}>{referralUrl}</h2>
            </div>
            <button className="admin-primary-button" type="button" onClick={() => void copyLink()}>
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </button>
          </div>

          {error && (
            <div className="admin-inline-error" role="alert">
              {error}
            </div>
          )}

          {!data && !error && <p>Yükleniyor…</p>}

          {data && (
            <div className="admin-bulk-toolbar" style={{ flexWrap: "wrap", gap: 24, marginTop: 24 }}>
              <div>
                <strong>{data.customerCount}</strong>
                <div>Getirdiğiniz müşteri</div>
              </div>
              <div>
                <strong>{data.orderCount}</strong>
                <div>Toplam sipariş</div>
              </div>
              <div>
                <strong>{money.format(data.revenue / 100)}</strong>
                <div>Toplam ciro</div>
              </div>
              <div>
                <strong>{money.format(data.commissionTotal / 100)}</strong>
                <div>Toplam hakkedilen (%{data.commissionRate})</div>
              </div>
              <div>
                <strong>{money.format(data.payoutTotal / 100)}</strong>
                <div>Ödenen</div>
              </div>
              <div>
                <strong>{money.format(data.pendingTotal / 100)}</strong>
                <div>Bekleyen</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
