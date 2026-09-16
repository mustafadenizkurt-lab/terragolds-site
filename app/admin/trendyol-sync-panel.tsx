"use client";

import { useState } from "react";

type SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

type PricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

type OrderSyncResult = {
  imported: number;
  errors: string[];
};

// Trendyol onayı ve API kimlik bilgileri (Supplier ID, API Key, API Secret)
// henüz elimizde değil - bu panel ve arkasındaki lib/trendyol/* kodu
// altyapı hazırlığı olarak duruyor. Bu ekrandaki hiçbir buton şu an gerçek
// bir sonuç üretmeyecek; her biri "TRENDYOL_SUPPLIER_ID ortam değişkeni
// ayarlanmamış" gibi net bir hata döndürecek, ta ki Ayarlar bölümündeki
// (şimdilik pasif) kimlik bilgileri gerçek değerlerle doldurulup Worker
// secret olarak eklenene kadar.
export default function TrendyolSyncPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [batchSize, setBatchSize] = useState(25);

  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [lastPriceResult, setLastPriceResult] = useState<PricePushResult | null>(null);

  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [lastOrderResult, setLastOrderResult] = useState<OrderSyncResult | null>(null);

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/trendyol/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize }),
        cache: "no-store",
      });
      const body = (await response.json()) as SyncResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastResult(body);
      onNotice(
        `Trendyol: ${body.created} ürün gönderildi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Trendyol senkronu başarısız.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pushPrices = async () => {
    setPriceBusy(true);
    setPriceError("");
    try {
      const response = await fetch("/api/admin/trendyol/push-prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize: 100 }),
        cache: "no-store",
      });
      const body = (await response.json()) as PricePushResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastPriceResult(body);
      onNotice(
        `Trendyol fiyat: ${body.pushed} ürün güncellendi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (priceFail) {
      setPriceError(
        priceFail instanceof Error
          ? priceFail.message
          : "Trendyol fiyat güncellemesi başarısız.",
      );
    } finally {
      setPriceBusy(false);
    }
  };

  const pullOrders = async () => {
    setOrderBusy(true);
    setOrderError("");
    try {
      const response = await fetch("/api/admin/trendyol/orders", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as OrderSyncResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastOrderResult(body);
      onNotice(`Trendyol: ${body.imported} yeni sipariş çekildi.`);
    } catch (orderFail) {
      setOrderError(
        orderFail instanceof Error
          ? orderFail.message
          : "Trendyol siparişleri alınamadı.",
      );
    } finally {
      setOrderBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Trendyol Marketplace</p>
          <h2>Ürün senkronizasyonu</h2>
          <p>
            Yayındaki ürünleri Trendyol&apos;a gönderir. Trendyol onayı ve
            API kimlik bilgileri henüz elimizde olmadığı için bu buton şu an
            hata verecektir - bu beklenen bir durum, altyapı hazır, sadece
            kimlik bilgileri eksik.
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

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Fiyat ve stok güncelle</h2>
          <p>
            D1&apos;de fiyatı veya stoku değişen ama Trendyol&apos;a henüz
            yansımamış ürünleri günceller. D1 her zaman tek gerçek kaynak -
            Trendyol tarafında yapılan bir değişiklik asla D1&apos;e geri
            okunmaz.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={priceBusy}
          onClick={() => void pushPrices()}
        >
          {priceBusy ? "Güncelleniyor…" : "Fiyat/stok güncelle"}
        </button>
      </div>
      {priceError && (
        <div className="admin-inline-error" role="alert">
          {priceError}
        </div>
      )}
      {lastPriceResult && (
        <div className="admin-bulk-toolbar">
          <strong>{lastPriceResult.pushed} ürün güncellendi</strong>
          <span>{lastPriceResult.failed} hata</span>
          <span>{lastPriceResult.remaining} ürün sırada</span>
        </div>
      )}

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Siparişleri çek</h2>
          <p>
            Son 7 günün Trendyol siparişlerini D1&apos;e aktarır (Trendyol
            webhook değil, dönemsel çekme kullanıyor). Kargoya verme durumu
            sadece bu admin panelinden değiştirilir ve tek yönlü olarak
            Trendyol&apos;a bildirilir - Kargo sayfasındaki sipariş
            listesinde &quot;Trendyol&quot; etiketiyle görünür.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={orderBusy}
          onClick={() => void pullOrders()}
        >
          {orderBusy ? "Çekiliyor…" : "Siparişleri çek"}
        </button>
      </div>
      {orderError && (
        <div className="admin-inline-error" role="alert">
          {orderError}
        </div>
      )}
      {lastOrderResult && (
        <div className="admin-bulk-toolbar">
          <strong>{lastOrderResult.imported} yeni sipariş çekildi</strong>
        </div>
      )}
      {lastOrderResult && lastOrderResult.errors.length > 0 && (
        <div className="admin-supplier-table-wrap">
          <table className="admin-supplier-table">
            <thead>
              <tr>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {lastOrderResult.errors.map((message, index) => (
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
