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

// Hepsiburada onayı ve API kimlik bilgileri (Merchant ID, kullanıcı adı,
// şifre) henüz elimizde değil - bu panel ve arkasındaki lib/hepsiburada/*
// kodu altyapı hazırlığı olarak duruyor (lib/trendyol/* ile aynı desen).
// Bu ekrandaki hiçbir buton şu an gerçek bir sonuç üretmeyecek; her biri
// "HEPSIBURADA_MERCHANT_ID ortam değişkeni ayarlanmamış" gibi net bir hata
// döndürecek, ta ki Ayarlar bölümündeki (şimdilik pasif) kimlik bilgileri
// gerçek değerlerle doldurulup Worker secret olarak eklenene kadar.
export default function HepsiburadaSyncPanel({
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
      const response = await fetch("/api/admin/hepsiburada/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize }),
        cache: "no-store",
      });
      const body = (await response.json()) as SyncResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastResult(body);
      onNotice(
        `Hepsiburada: ${body.created} ürün gönderildi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Hepsiburada senkronu başarısız.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pushPrices = async () => {
    setPriceBusy(true);
    setPriceError("");
    try {
      const response = await fetch("/api/admin/hepsiburada/push-prices", {
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
        `Hepsiburada fiyat: ${body.pushed} ürün güncellendi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (priceFail) {
      setPriceError(
        priceFail instanceof Error
          ? priceFail.message
          : "Hepsiburada fiyat güncellemesi başarısız.",
      );
    } finally {
      setPriceBusy(false);
    }
  };

  const pullOrders = async () => {
    setOrderBusy(true);
    setOrderError("");
    try {
      const response = await fetch("/api/admin/hepsiburada/orders", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as OrderSyncResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastOrderResult(body);
      onNotice(`Hepsiburada: ${body.imported} yeni sipariş çekildi.`);
    } catch (orderFail) {
      setOrderError(
        orderFail instanceof Error
          ? orderFail.message
          : "Hepsiburada siparişleri alınamadı.",
      );
    } finally {
      setOrderBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Hepsiburada Marketplace</p>
          <h2>Ürün senkronizasyonu</h2>
          <p>
            Yayındaki ürünleri Hepsiburada&apos;ya gönderir. Hepsiburada
            onayı ve API kimlik bilgileri henüz elimizde olmadığı için bu
            buton şu an hata verecektir - bu beklenen bir durum, altyapı
            hazır, sadece kimlik bilgileri eksik.
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
            D1&apos;de fiyatı veya stoku değişen ama Hepsiburada&apos;ya
            henüz yansımamış ürünleri günceller. D1 her zaman tek gerçek
            kaynak - Hepsiburada tarafında yapılan bir değişiklik asla
            D1&apos;e geri okunmaz.
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
            Son 7 günün Hepsiburada siparişlerini D1&apos;e aktarır
            (Hepsiburada webhook değil, dönemsel çekme kullanıyor). Kargoya
            verme durumu sadece bu admin panelinden değiştirilir ve tek
            yönlü olarak Hepsiburada&apos;ya bildirilir - Kargo sayfasındaki
            sipariş listesinde &quot;Hepsiburada&quot; etiketiyle görünür.
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
