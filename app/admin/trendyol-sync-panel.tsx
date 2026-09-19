"use client";

import { useRef, useState } from "react";
import MarketplaceCredentialsPanel from "./marketplace-credentials-panel";

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

// Kimlik bilgileri bu ekranın en üstündeki MarketplaceCredentialsPanel'den
// girilip D1'de şifreli saklanıyor - wrangler CLI gerekmiyor. Gerçek API
// bilgileri girilip "Senkronu etkinleştir" işaretlenmeden buradaki butonlar
// "pazaryeri henüz yapılandırılmamış" gibi net bir hata döner.
export default function TrendyolSyncPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [batchSize, setBatchSize] = useState(25);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoTotals, setAutoTotals] = useState({ created: 0, failed: 0 });
  const autoStopRef = useRef(false);

  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [lastPriceResult, setLastPriceResult] = useState<PricePushResult | null>(null);

  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [lastOrderResult, setLastOrderResult] = useState<OrderSyncResult | null>(null);

  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categoryResults, setCategoryResults] = useState<
    { id: number; path: string }[] | null
  >(null);

  const searchCategories = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryBusy(true);
    setCategoryError("");
    try {
      const response = await fetch(
        `/api/admin/trendyol/categories?name=${encodeURIComponent(categoryQuery)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        categories?: { id: number; path: string }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Kategoriler alınamadı.");
      setCategoryResults(body.categories ?? []);
    } catch (searchError) {
      setCategoryError(
        searchError instanceof Error
          ? searchError.message
          : "Kategoriler alınamadı.",
      );
    } finally {
      setCategoryBusy(false);
    }
  };

  const [attributeCategoryId, setAttributeCategoryId] = useState("");
  const [attributeBusy, setAttributeBusy] = useState(false);
  const [attributeError, setAttributeError] = useState("");
  const [attributeResults, setAttributeResults] = useState<
    {
      id: number;
      name: string;
      required: boolean;
      allowCustom: boolean;
      values: { id: number; name: string }[];
    }[] | null
  >(null);

  const searchAttributes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttributeBusy(true);
    setAttributeError("");
    try {
      const response = await fetch(
        `/api/admin/trendyol/category-attributes?categoryId=${encodeURIComponent(attributeCategoryId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        attributes?: {
          id: number;
          name: string;
          required: boolean;
          allowCustom: boolean;
          values: { id: number; name: string }[];
        }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Kategori özellikleri alınamadı.");
      setAttributeResults(body.attributes ?? []);
    } catch (searchError) {
      setAttributeError(
        searchError instanceof Error
          ? searchError.message
          : "Kategori özellikleri alınamadı.",
      );
    } finally {
      setAttributeBusy(false);
    }
  };

  const [brandQuery, setBrandQuery] = useState("");
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState("");
  const [brandResults, setBrandResults] = useState<
    { id: number; name: string }[] | null
  >(null);

  const searchBrands = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBrandBusy(true);
    setBrandError("");
    try {
      const response = await fetch(
        `/api/admin/trendyol/brands?name=${encodeURIComponent(brandQuery)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        brands?: { id: number; name: string }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Markalar alınamadı.");
      setBrandResults(body.brands ?? []);
    } catch (searchError) {
      setBrandError(
        searchError instanceof Error ? searchError.message : "Markalar alınamadı.",
      );
    } finally {
      setBrandBusy(false);
    }
  };

  // Sunucudan tek bir parti ister - hem tekil "Şimdi senkronla" butonu hem de
  // aşağıdaki otomatik döngü (syncAll) tarafından paylaşılıyor.
  const runOneBatch = async (): Promise<SyncResult> => {
    const response = await fetch("/api/admin/trendyol/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchSize }),
      cache: "no-store",
    });
    const body = (await response.json()) as SyncResult & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
    return body;
  };

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const body = await runOneBatch();
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

  // "Hepsini gönder": sıra bitene (remaining=0) kadar partileri arka arkaya
  // gönderir - elle onlarca kez "Şimdi senkronla"ya basmak yerine. Bir
  // partide hata çıkarsa (failed > 0) durur - kullanıcı sebebini görüp karar
  // versin diye, sessizce yığılıp devam etmiyor. "Durdur" ile her an
  // kesilebilir.
  const syncAll = async () => {
    setAutoRunning(true);
    autoStopRef.current = false;
    setError("");
    setAutoTotals({ created: 0, failed: 0 });
    try {
      for (;;) {
        if (autoStopRef.current) {
          onNotice("Otomatik gönderim durduruldu.");
          break;
        }
        const body = await runOneBatch();
        setLastResult(body);
        setAutoTotals((totals) => ({
          created: totals.created + body.created,
          failed: totals.failed + body.failed,
        }));
        if (body.failed > 0) {
          onNotice(
            `Otomatik gönderim durdu: bu partide ${body.failed} hata var, ${body.remaining} ürün hâlâ sırada.`,
          );
          break;
        }
        if (body.remaining === 0) {
          onNotice(`Trendyol: tüm ürünler gönderildi (toplam ${body.created} bu partide dahil).`);
          break;
        }
      }
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Trendyol senkronu başarısız.",
      );
    } finally {
      setAutoRunning(false);
    }
  };

  const stopAutoSync = () => {
    autoStopRef.current = true;
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
    <div className="admin-marketplace-sync">
      <MarketplaceCredentialsPanel provider="trendyol" onNotice={onNotice} />

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Trendyol Marketplace</p>
            <h2>Kategori ara</h2>
            <p>
              Ürün gönderirken gereken categoryId&apos;yi bulmak için
              Trendyol&apos;un kendi kategori ağacında arama yapar (ör.
              &quot;Kolye&quot;, &quot;Yüzük&quot;).
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={searchCategories}>
          <label className="admin-field">
            <span>Aranacak kelime</span>
            <input
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
              placeholder="Kolye"
              required
            />
          </label>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={categoryBusy}
            style={{ alignSelf: "flex-end" }}
          >
            {categoryBusy ? "Aranıyor…" : "Ara"}
          </button>
        </form>
        {categoryError && (
          <div className="admin-inline-error" role="alert">
            {categoryError}
          </div>
        )}
        {categoryResults && (
          <div className="admin-supplier-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-supplier-table">
              <thead>
                <tr>
                  <th>Kategori yolu</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {categoryResults.length === 0 && (
                  <tr>
                    <td colSpan={2}>Eşleşen kategori bulunamadı.</td>
                  </tr>
                )}
                {categoryResults.map((category) => (
                  <tr key={category.id}>
                    <td>{category.path}</td>
                    <td>{category.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Trendyol Marketplace</p>
            <h2>Kategori özelliklerini gör</h2>
            <p>
              Bir kategori ID&apos;si için Trendyol&apos;un zorunlu tuttuğu
              özellikleri (ör. Renk, Materyal) gösterir - ürün gönderirken
              bu alanlardan zorunlu (Evet) olanlar eksikse istek
              reddedilebilir.
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={searchAttributes}>
          <label className="admin-field">
            <span>Kategori ID</span>
            <input
              value={attributeCategoryId}
              onChange={(event) => setAttributeCategoryId(event.target.value)}
              placeholder="2853"
              inputMode="numeric"
              required
            />
          </label>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={attributeBusy}
            style={{ alignSelf: "flex-end" }}
          >
            {attributeBusy ? "Aranıyor…" : "Getir"}
          </button>
        </form>
        {attributeError && (
          <div className="admin-inline-error" role="alert">
            {attributeError}
          </div>
        )}
        {attributeResults && (
          <div className="admin-supplier-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-supplier-table">
              <thead>
                <tr>
                  <th>Özellik</th>
                  <th>Zorunlu</th>
                  <th>Serbest metin</th>
                  <th>Örnek değerler</th>
                </tr>
              </thead>
              <tbody>
                {attributeResults.length === 0 && (
                  <tr>
                    <td colSpan={4}>Bu kategoride tanımlı özellik yok.</td>
                  </tr>
                )}
                {attributeResults.map((attribute) => (
                  <tr key={attribute.id}>
                    <td>{attribute.name}</td>
                    <td>{attribute.required ? "Evet" : "Hayır"}</td>
                    <td>{attribute.allowCustom ? "Evet" : "Hayır"}</td>
                    <td>
                      {attribute.values.map((value) => value.name).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Trendyol Marketplace</p>
            <h2>Marka ara</h2>
            <p>
              Trendyol markasız ürün kabul etmiyor - her ürün için geçerli
              bir brandId gerekiyor. Kayıtlı markanızı veya &quot;Genel
              Markalar&quot; gibi genel bir seçeneği burada arayabilirsiniz.
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={searchBrands}>
          <label className="admin-field">
            <span>Aranacak kelime</span>
            <input
              value={brandQuery}
              onChange={(event) => setBrandQuery(event.target.value)}
              placeholder="Genel Markalar"
              required
            />
          </label>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={brandBusy}
            style={{ alignSelf: "flex-end" }}
          >
            {brandBusy ? "Aranıyor…" : "Ara"}
          </button>
        </form>
        {brandError && (
          <div className="admin-inline-error" role="alert">
            {brandError}
          </div>
        )}
        {brandResults && (
          <div className="admin-supplier-table-wrap" style={{ marginTop: 16 }}>
            <table className="admin-supplier-table">
              <thead>
                <tr>
                  <th>Marka adı</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {brandResults.length === 0 && (
                  <tr>
                    <td colSpan={2}>Eşleşen marka bulunamadı.</td>
                  </tr>
                )}
                {brandResults.map((brand) => (
                  <tr key={brand.id}>
                    <td>{brand.name}</td>
                    <td>{brand.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Trendyol Marketplace</p>
          <h2>Ürün senkronizasyonu</h2>
          <p>
            Yayındaki ürünleri Trendyol&apos;a gönderir. Bağlantı bilgileri
            henüz kaydedilip etkinleştirilmediyse bu buton hata verir - önce
            yukarıdaki bağlantı bilgilerini kaydedin.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="admin-primary-button"
            type="button"
            disabled={busy || autoRunning}
            onClick={() => void sync()}
          >
            {busy ? "Gönderiliyor…" : "Şimdi senkronla"}
          </button>
          {autoRunning ? (
            <button className="payment-disconnect" type="button" onClick={stopAutoSync}>
              Durdur
            </button>
          ) : (
            <button
              className="admin-primary-button"
              type="button"
              disabled={busy}
              onClick={() => void syncAll()}
            >
              Hepsini gönder
            </button>
          )}
        </div>
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
      {autoRunning && (
        <div className="admin-bulk-toolbar">
          <strong>Otomatik gönderiliyor…</strong>
          <span>{autoTotals.created} ürün gönderildi (bu oturumda)</span>
          <span>{autoTotals.failed} hata</span>
          {lastResult && <span>{lastResult.remaining} ürün sırada</span>}
        </div>
      )}
      {!autoRunning && lastResult && (
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
    </div>
  );
}
