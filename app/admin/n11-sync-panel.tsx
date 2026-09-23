"use client";

import { useState } from "react";
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

type CategoryAttribute = {
  id: number;
  name: string;
  isMandatory: boolean;
  isCustomValue: boolean;
  isVariant?: boolean;
  attributeValues?: { id: number; name?: string; value?: string }[];
};

// Kimlik bilgileri bu ekranın en üstündeki MarketplaceCredentialsPanel'den
// girilip D1'de şifreli saklanıyor (Trendyol/Hepsiburada panelleriyle aynı
// desen). Ürün senkronu, N11 kategori eşlemesi (lib/n11/sync.ts >
// N11_CATEGORY_BY_GROUP_SLUG) doldurulana kadar her ürün için net bir hata
// döner - aşağıdaki "Kategori ara" ve "Kategori özellikleri" araçları bu
// eşlemeyi bulmak için var.
export default function N11SyncPanel({
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

  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categoryResults, setCategoryResults] = useState<
    { id: number; path: string }[] | null
  >(null);

  const [attributeCategoryId, setAttributeCategoryId] = useState("");
  const [attributeBusy, setAttributeBusy] = useState(false);
  const [attributeError, setAttributeError] = useState("");
  const [attributeResults, setAttributeResults] = useState<CategoryAttribute[] | null>(
    null,
  );

  const [taskId, setTaskId] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskResult, setTaskResult] = useState<unknown>(null);

  const searchCategories = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryBusy(true);
    setCategoryError("");
    try {
      const response = await fetch(
        `/api/admin/n11/categories?name=${encodeURIComponent(categoryQuery)}`,
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
        searchError instanceof Error ? searchError.message : "Kategoriler alınamadı.",
      );
    } finally {
      setCategoryBusy(false);
    }
  };

  const searchAttributes = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttributeBusy(true);
    setAttributeError("");
    try {
      const response = await fetch(
        `/api/admin/n11/category-attributes?categoryId=${encodeURIComponent(attributeCategoryId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        attributes?: CategoryAttribute[];
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

  const checkTaskStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTaskBusy(true);
    setTaskError("");
    try {
      const response = await fetch(
        `/api/admin/n11/task-status?taskId=${encodeURIComponent(taskId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as { result?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Görev durumu alınamadı.");
      setTaskResult(body.result ?? null);
    } catch (taskFail) {
      setTaskError(taskFail instanceof Error ? taskFail.message : "Görev durumu alınamadı.");
    } finally {
      setTaskBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/n11/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize }),
        cache: "no-store",
      });
      const body = (await response.json()) as SyncResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastResult(body);
      onNotice(
        `N11: ${body.created} ürün gönderildi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "N11 senkronu başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const pushPrices = async () => {
    setPriceBusy(true);
    setPriceError("");
    try {
      const response = await fetch("/api/admin/n11/push-prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize: 100 }),
        cache: "no-store",
      });
      const body = (await response.json()) as PricePushResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastPriceResult(body);
      onNotice(
        `N11 fiyat: ${body.pushed} ürün güncellendi, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (priceFail) {
      setPriceError(
        priceFail instanceof Error
          ? priceFail.message
          : "N11 fiyat güncellemesi başarısız.",
      );
    } finally {
      setPriceBusy(false);
    }
  };

  const pullOrders = async () => {
    setOrderBusy(true);
    setOrderError("");
    try {
      const response = await fetch("/api/admin/n11/orders", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as OrderSyncResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastOrderResult(body);
      onNotice(`N11: ${body.imported} yeni sipariş çekildi.`);
    } catch (orderFail) {
      setOrderError(
        orderFail instanceof Error ? orderFail.message : "N11 siparişleri alınamadı.",
      );
    } finally {
      setOrderBusy(false);
    }
  };

  return (
    <div className="admin-marketplace-sync">
      <MarketplaceCredentialsPanel provider="n11" onNotice={onNotice} />

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">N11 Marketplace</p>
            <h2>1. Kategori ara</h2>
            <p>
              N11&apos;in kendi kategori ağacında arama yapar. Bulduğunuz
              categoryId&apos;yi not edin - ürün göndermeden önce
              <code> lib/n11/sync.ts</code> içindeki kategori eşleme
              tablosuna eklenmesi gerekiyor.
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={searchCategories}>
          <label className="admin-field">
            <span>Aranacak kelime</span>
            <input
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
              placeholder="ör. Bileklik, Kolye, Çelik Yüzük"
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
          <div className="admin-supplier-table-wrap">
            <table className="admin-supplier-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Yol</th>
                </tr>
              </thead>
              <tbody>
                {categoryResults.map((category) => (
                  <tr key={category.id}>
                    <td>{category.id}</td>
                    <td>{category.path}</td>
                  </tr>
                ))}
                {categoryResults.length === 0 && (
                  <tr>
                    <td colSpan={2}>Eşleşen kategori bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>2. Kategori özellikleri</h2>
            <p>
              Yukarıda bulduğunuz categoryId için N11&apos;in zorunlu
              (isMandatory) ürün özelliklerini gösterir - bunlar
              doldurulmadan ürün gönderimi N11 tarafından reddedilir.
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={searchAttributes}>
          <label className="admin-field">
            <span>categoryId</span>
            <input
              type="number"
              value={attributeCategoryId}
              onChange={(event) => setAttributeCategoryId(event.target.value)}
              placeholder="ör. 2845"
              required
            />
          </label>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={attributeBusy}
            style={{ alignSelf: "flex-end" }}
          >
            {attributeBusy ? "Sorgulanıyor…" : "Özellikleri getir"}
          </button>
        </form>
        {attributeError && (
          <div className="admin-inline-error" role="alert">
            {attributeError}
          </div>
        )}
        {attributeResults && (
          <div className="admin-supplier-table-wrap">
            <table className="admin-supplier-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ad</th>
                  <th>Zorunlu</th>
                  <th>Serbest metin</th>
                  <th>Örnek değerler</th>
                </tr>
              </thead>
              <tbody>
                {attributeResults.map((attribute) => (
                  <tr key={attribute.id}>
                    <td>{attribute.id}</td>
                    <td>{attribute.name}</td>
                    <td>{attribute.isMandatory ? "Evet" : "Hayır"}</td>
                    <td>{attribute.isCustomValue ? "Evet" : "Hayır"}</td>
                    <td>
                      {(attribute.attributeValues ?? [])
                        .slice(0, 5)
                        .map((value) => `${value.name ?? value.value ?? "?"} (${value.id})`)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
                {attributeResults.length === 0 && (
                  <tr>
                    <td colSpan={5}>Bu kategori için özellik bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>3. Ürün senkronizasyonu</h2>
            <p>
              Yayındaki ürünleri N11&apos;e gönderir. Kategori eşlemesi
              (yukarıdaki 1-2 numaralı adımlar) tamamlanmadan bu buton her
              ürün için &quot;N11 kategori eşlemesi henüz
              yapılandırılmamış&quot; hatası döner - bilinçli bir güvenlik
              önlemi, yanlış kategoriyle ürün göndermemek için.
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
            <h2>Görev durumu sorgula</h2>
            <p>
              Yukarıdaki gönderim asenkron - N11 hemen bir taskId döner ama
              ürünün gerçekten kabul mü edildiği, reddedildiyse hangi
              sebeple, ancak bu sorguyla netleşir.
            </p>
          </div>
        </div>
        <form className="admin-field-grid" onSubmit={checkTaskStatus}>
          <label className="admin-field">
            <span>taskId</span>
            <input
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="Gönderim sonrası dönen görev kimliği"
              required
            />
          </label>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={taskBusy}
            style={{ alignSelf: "flex-end" }}
          >
            {taskBusy ? "Sorgulanıyor…" : "Durumu getir"}
          </button>
        </form>
        {taskError && (
          <div className="admin-inline-error" role="alert">
            {taskError}
          </div>
        )}
        {taskResult !== null && (
          <pre className="admin-supplier-table-wrap" style={{ padding: 12, overflow: "auto" }}>
            {JSON.stringify(taskResult, null, 2)}
          </pre>
        )}

        <div className="admin-panel-heading" style={{ marginTop: 32 }}>
          <div>
            <h2>Fiyat ve stok güncelle</h2>
            <p>
              D1&apos;de fiyatı veya stoku değişen ama N11&apos;e henüz
              yansımamış ürünleri günceller.
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
              Son 7 günün N11 siparişlerini D1&apos;e aktarır (webhook değil,
              dönemsel çekme). Kargoya verme durumu sadece bu admin
              panelinden değiştirilir ve tek yönlü olarak N11&apos;e
              bildirilir.
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
