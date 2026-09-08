"use client";

import { useState } from "react";

type SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

export default function ShopifySyncPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [batchSize, setBatchSize] = useState(25);

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shopify/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize }),
        cache: "no-store",
      });
      const body = (await response.json()) as SyncResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastResult(body);
      onNotice(
        `Shopify: ${body.created} ürün gönderildi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Shopify senkronu başarısız.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Shopify</p>
          <h2>Ürün senkronizasyonu</h2>
          <p>
            Yayındaki ürünleri Shopify mağazanıza gönderir. Zaten gönderilmiş
            ürünler tekrar gönderilmez; 6 saatte bir otomatik olarak da
            çalışır.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={busy}
          onClick={() => void sync()}
        >
          {busy ? "Gönderiliyor…" : "Şimdi senkronla"}
        </button>
      </div>
      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}
      <label className="admin-field" style={{ maxWidth: 220 }}>
        <span>Bir seferde kaç ürün gönderilsin</span>
        <input
          type="number"
          min={1}
          max={100}
          value={batchSize}
          onChange={(event) => setBatchSize(Number(event.target.value) || 25)}
        />
      </label>
      {lastResult && (
        <div className="admin-bulk-toolbar">
          <strong>{lastResult.created} ürün gönderildi</strong>
          <span>{lastResult.failed} hata</span>
          <span>{lastResult.remaining} ürün sırada</span>
        </div>
      )}
      {lastResult && lastResult.errors.length > 0 && (
        <div className="admin-supplier-table-wrap">
          <table className="admin-supplier-table">
            <thead>
              <tr>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {lastResult.errors.map((message, index) => (
                <tr key={index}>
                  <td>{message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
