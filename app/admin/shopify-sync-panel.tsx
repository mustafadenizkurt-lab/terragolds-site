"use client";

import { useState } from "react";

type SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

type PublishResult = {
  published: number;
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
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [lastPublishResult, setLastPublishResult] =
    useState<PublishResult | null>(null);
  const [themeBusy, setThemeBusy] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [themeApplied, setThemeApplied] = useState(false);
  const [homepageBusy, setHomepageBusy] = useState(false);
  const [homepageError, setHomepageError] = useState("");
  const [homepageApplied, setHomepageApplied] = useState(false);
  const [productPageBusy, setProductPageBusy] = useState(false);
  const [productPageError, setProductPageError] = useState("");
  const [productPageApplied, setProductPageApplied] = useState(false);
  const [headerFooterBusy, setHeaderFooterBusy] = useState(false);
  const [headerFooterError, setHeaderFooterError] = useState("");
  const [headerFooterApplied, setHeaderFooterApplied] = useState(false);

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

  const publish = async () => {
    setPublishBusy(true);
    setPublishError("");
    try {
      const response = await fetch("/api/admin/shopify/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize: 50 }),
        cache: "no-store",
      });
      const body = (await response.json()) as PublishResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setLastPublishResult(body);
      onNotice(
        `Shopify vitrin: ${body.published} ürün yayınlandı, ${body.failed} hata, ${body.remaining} ürün sırada.`,
      );
    } catch (publishFail) {
      setPublishError(
        publishFail instanceof Error
          ? publishFail.message
          : "Shopify vitrin yayını başarısız.",
      );
    } finally {
      setPublishBusy(false);
    }
  };

  const applyTheme = async () => {
    setThemeBusy(true);
    setThemeError("");
    setThemeApplied(false);
    try {
      const response = await fetch("/api/admin/shopify/theme/apply-brand", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setThemeApplied(true);
      onNotice("Shopify tema renk/tipografi ayarları güncellendi.");
    } catch (themeFail) {
      setThemeError(
        themeFail instanceof Error
          ? themeFail.message
          : "Tema güncellenemedi.",
      );
    } finally {
      setThemeBusy(false);
    }
  };

  const applyHomepage = async () => {
    setHomepageBusy(true);
    setHomepageError("");
    setHomepageApplied(false);
    try {
      const response = await fetch("/api/admin/shopify/theme/apply-homepage", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setHomepageApplied(true);
      onNotice("Ana sayfaya kategori bölümleri eklendi.");
    } catch (homepageFail) {
      setHomepageError(
        homepageFail instanceof Error
          ? homepageFail.message
          : "Ana sayfa düzeni güncellenemedi.",
      );
    } finally {
      setHomepageBusy(false);
    }
  };

  const applyProductPage = async () => {
    setProductPageBusy(true);
    setProductPageError("");
    setProductPageApplied(false);
    try {
      const response = await fetch("/api/admin/shopify/theme/apply-product-page", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setProductPageApplied(true);
      onNotice("Ürün sayfası düzeni güncellendi.");
    } catch (productPageFail) {
      setProductPageError(
        productPageFail instanceof Error
          ? productPageFail.message
          : "Ürün sayfası güncellenemedi.",
      );
    } finally {
      setProductPageBusy(false);
    }
  };

  const applyHeaderFooter = async () => {
    setHeaderFooterBusy(true);
    setHeaderFooterError("");
    setHeaderFooterApplied(false);
    try {
      const response = await fetch("/api/admin/shopify/theme/apply-header-footer", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
      setHeaderFooterApplied(true);
      onNotice("Header ve footer düzeni güncellendi.");
    } catch (headerFooterFail) {
      setHeaderFooterError(
        headerFooterFail instanceof Error
          ? headerFooterFail.message
          : "Header/footer güncellenemedi.",
      );
    } finally {
      setHeaderFooterBusy(false);
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

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Vitrine yayınla</h2>
          <p>
            Daha önce Shopify&apos;a gönderilmiş ama mağaza vitrininde
            (Online Store satış kanalında) henüz görünmeyen ürünleri
            yayınlar. Yeni gönderilen ürünler artık otomatik yayınlanıyor,
            bu buton sadece eski bir senkron turundan kalanları düzeltir.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={publishBusy}
          onClick={() => void publish()}
        >
          {publishBusy ? "Yayınlanıyor…" : "Şimdi yayınla"}
        </button>
      </div>
      {publishError && (
        <div className="admin-inline-error" role="alert">
          {publishError}
        </div>
      )}
      {lastPublishResult && (
        <div className="admin-bulk-toolbar">
          <strong>{lastPublishResult.published} ürün yayınlandı</strong>
          <span>{lastPublishResult.failed} hata</span>
          <span>{lastPublishResult.remaining} ürün sırada</span>
        </div>
      )}
      {lastPublishResult && lastPublishResult.errors.length > 0 && (
        <div className="admin-supplier-table-wrap">
          <table className="admin-supplier-table">
            <thead>
              <tr>
                <th>Hata</th>
              </tr>
            </thead>
            <tbody>
              {lastPublishResult.errors.map((message, index) => (
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
          <h2>Tema tasarımı</h2>
          <p>
            Horizon temasının renk paletini (beyaz/siyah zemin, mat altın
            aksan) ve başlık tipografisini premium/minimalist bir görünüme
            günceller. Sadece renk ve font ayarlarına dokunur, ürün/sayfa
            içeriğini değiştirmez.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={themeBusy}
          onClick={() => void applyTheme()}
        >
          {themeBusy ? "Uygulanıyor…" : "Temayı uygula"}
        </button>
      </div>
      {themeError && (
        <div className="admin-inline-error" role="alert">
          {themeError}
        </div>
      )}
      {themeApplied && (
        <div className="admin-bulk-toolbar">
          <strong>Tema güncellendi</strong>
          <span>Vitrinde kontrol edebilirsin</span>
        </div>
      )}

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Ana sayfa kategorileri</h2>
          <p>
            Kolye, Yüzük, Küpe, Bileklik, Halhal, Vintage, Porselen ve
            Koleksiyon için otomatik koleksiyonlar oluşturur (yoksa) ve ana
            sayfaya hero&apos;dan hemen sonra her biri için bir ürün vitrini
            bölümü ekler. Var olan &quot;Tüm Ürünler&quot; bölümüne dokunmaz.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={homepageBusy}
          onClick={() => void applyHomepage()}
        >
          {homepageBusy ? "Uygulanıyor…" : "Kategorileri ekle"}
        </button>
      </div>
      {homepageError && (
        <div className="admin-inline-error" role="alert">
          {homepageError}
        </div>
      )}
      {homepageApplied && (
        <div className="admin-bulk-toolbar">
          <strong>Ana sayfa güncellendi</strong>
          <span>Vitrinde kontrol edebilirsin</span>
        </div>
      )}

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Ürün sayfası düzeni</h2>
          <p>
            Ürün galerisini tek büyük görsel + alt küçük resim şeridi olacak
            şekilde sadeleştirir, boş duran bilgi akordiyonunu Kargo &amp;
            Teslimat / İade &amp; Değişim / Ürün Bakımı içerikleriyle
            doldurur ve &quot;You may also like&quot; başlığını Türkçeye
            çevirir.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={productPageBusy}
          onClick={() => void applyProductPage()}
        >
          {productPageBusy ? "Uygulanıyor…" : "Ürün sayfasını güncelle"}
        </button>
      </div>
      {productPageError && (
        <div className="admin-inline-error" role="alert">
          {productPageError}
        </div>
      )}
      {productPageApplied && (
        <div className="admin-bulk-toolbar">
          <strong>Ürün sayfası güncellendi</strong>
          <span>Bir ürün sayfasında kontrol edebilirsin</span>
        </div>
      )}

      <div className="admin-panel-heading" style={{ marginTop: 32 }}>
        <div>
          <h2>Header &amp; footer</h2>
          <p>
            Logoyu ortalar, tek pazar için gereksiz ülke/dil seçicilerini
            kaldırır ve footer&apos;da hiç kurulmamış
            Facebook/Twitter/YouTube ikonlarını kaldırır (Instagram ve
            TikTok kalır).
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          disabled={headerFooterBusy}
          onClick={() => void applyHeaderFooter()}
        >
          {headerFooterBusy ? "Uygulanıyor…" : "Header/footer güncelle"}
        </button>
      </div>
      {headerFooterError && (
        <div className="admin-inline-error" role="alert">
          {headerFooterError}
        </div>
      )}
      {headerFooterApplied && (
        <div className="admin-bulk-toolbar">
          <strong>Header/footer güncellendi</strong>
          <span>Ana sayfada kontrol edebilirsin</span>
        </div>
      )}
    </div>
  );
}
