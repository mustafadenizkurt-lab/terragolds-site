"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PaymentProviderId,
  PaymentProviderSummary,
} from "../../lib/payment-types";

const callbackPaths: Record<PaymentProviderId, string> = {
  shopier: "/api/payments/shopier/callback",
  paytr: "/api/payments/paytr/callback",
  iyzico: "/api/payments/iyzico/callback",
};

const providerMarks: Record<PaymentProviderId, string> = {
  shopier: "S",
  paytr: "P",
  iyzico: "iyzi",
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function PaymentProvidersPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [providers, setProviders] = useState<PaymentProviderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<PaymentProviderId | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    enabled: false,
    testMode: true,
    isPrimary: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shipping, setShipping] = useState({
    shippingFee: "79.90",
    freeShippingThreshold: "1000",
  });
  const [shippingSaving, setShippingSaving] = useState(false);

  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? null,
    [providers, selectedId],
  );

  const loadProviders = async () => {
    setLoading(true);
    setError("");
    try {
      const [response, shippingResponse] = await Promise.all([
        fetch("/api/admin/payment-providers", { cache: "no-store" }),
        fetch("/api/admin/shipping", { cache: "no-store" }),
      ]);
      const [body, shippingBody] = await Promise.all([
        readJson(response),
        readJson(shippingResponse),
      ]);
      setProviders(
        (body.providers as PaymentProviderSummary[] | undefined) ?? [],
      );
      setShipping(
        (shippingBody.shipping as typeof shipping | undefined) ?? shipping,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Ödeme yöntemleri alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The protected API returns masked configuration only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProviders();
  }, []);

  const openProvider = (provider: PaymentProviderSummary) => {
    setSelectedId(provider.id);
    setCredentials({});
    setDraft({
      enabled: provider.enabled,
      testMode: provider.supportsTestMode ? provider.testMode : false,
      isPrimary: provider.isPrimary,
    });
    setCopied(false);
    setError("");
  };

  const saveProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/payment-providers/${selected.id}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...draft, credentials }),
        },
      );
      const body = await readJson(response);
      setProviders(body.providers as PaymentProviderSummary[]);
      setCredentials({});
      setSelectedId(null);
      onNotice(`${selected.name} ödeme ayarları güvenle kaydedildi.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Ödeme yöntemi kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnectProvider = async () => {
    if (
      !selected ||
      !window.confirm(
        `${selected.name} bağlantısı ve kayıtlı anahtarları kaldırılacak. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/payment-providers/${selected.id}`,
        { method: "DELETE" },
      );
      const body = await readJson(response);
      setProviders(body.providers as PaymentProviderSummary[]);
      setSelectedId(null);
      setCredentials({});
      onNotice(`${selected.name} bağlantısı kaldırıldı.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Bağlantı kaldırılamadı.",
      );
    } finally {
      setSaving(false);
    }
  };

  const callbackUrl =
    selected && typeof window !== "undefined"
      ? `${window.location.origin}${callbackPaths[selected.id]}`
      : "";

  const saveShipping = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShippingSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shipping", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shipping),
      });
      const body = await readJson(response);
      setShipping(body.shipping as typeof shipping);
      onNotice("Kargo ücreti ve ücretsiz kargo limiti kaydedildi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Kargo ayarları kaydedilemedi.",
      );
    } finally {
      setShippingSaving(false);
    }
  };

  return (
    <div className="admin-payments">
      <section className="admin-payment-hero">
        <div>
          <p className="admin-kicker">Güvenli ödeme yönetimi</p>
          <h2>Ödeme altyapınızı tek yerden yönetin.</h2>
          <p>
            Müşteriniz kendi sağlayıcı bilgilerini burada tanımlar. Gizli
            anahtarlar kaydedildikten sonra görüntülenmez ve ödeme sırasında
            yalnızca sunucu tarafında kullanılır.
          </p>
        </div>
        <div className="admin-payment-security">
          <span aria-hidden="true">◆</span>
          <strong>Şifreli saklama</strong>
          <small>Anahtarlar tarayıcıya geri gönderilmez</small>
        </div>
      </section>

      {error && (
        <div className="admin-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Ödeme yöntemleri hazırlanıyor…</p>
        </div>
      ) : (
        <div className="admin-payment-grid">
          {providers.map((provider) => (
            <article
              className={`admin-payment-card${
                provider.enabled && provider.configured ? " connected" : ""
              }`}
              key={provider.id}
            >
              <header>
                <span className={`payment-mark ${provider.id}`}>
                  {providerMarks[provider.id]}
                </span>
                <span
                  className={
                    provider.enabled && provider.configured
                      ? "payment-state active"
                      : provider.configured
                        ? "payment-state ready"
                        : "payment-state"
                  }
                >
                  {provider.enabled && provider.configured
                    ? "Etkin"
                    : provider.configured
                      ? "Hazır"
                      : "Bağlı değil"}
                </span>
              </header>
              <h3>{provider.name}</h3>
              <p>{provider.shortDescription}</p>
              <dl>
                <div>
                  <dt>Bağlantı</dt>
                  <dd>
                    {provider.configured
                      ? provider.credentialHint || "Kaydedildi"
                      : "Kurulum gerekli"}
                  </dd>
                </div>
                <div>
                  <dt>Ortam</dt>
                  <dd>
                    {provider.supportsTestMode && provider.testMode
                      ? "Test"
                      : "Canlı"}
                  </dd>
                </div>
              </dl>
              {provider.isPrimary && provider.enabled && (
                <span className="payment-primary-label">
                  Birincil ödeme yöntemi
                </span>
              )}
              <button type="button" onClick={() => openProvider(provider)}>
                {provider.configured ? "Ayarları yönet" : "Kurulumu başlat"}
                <span>→</span>
              </button>
            </article>
          ))}
        </div>
      )}

      {!loading && (
        <form className="admin-shipping-settings" onSubmit={saveShipping}>
          <div>
            <p className="admin-kicker">Teslimat ücretleri</p>
            <h2>Kargo ayarları</h2>
            <p>
              Sepette gösterilecek kargo bedelini ve ücretsiz gönderim için
              ulaşılması gereken tutarı belirleyin.
            </p>
          </div>
          <div className="admin-shipping-fields">
            <label className="admin-field">
              <span>Kargo ücreti (TL)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shipping.shippingFee}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    shippingFee: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label className="admin-field">
              <span>Ücretsiz kargo alt limiti (TL)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shipping.freeShippingThreshold}
                onChange={(event) =>
                  setShipping((current) => ({
                    ...current,
                    freeShippingThreshold: event.target.value,
                  }))
                }
                required
              />
              <small>
                Örneğin 1.000 TL girilirse 999,99 TL tutarında kargo ücreti
                uygulanır. 0 girerseniz ücretsiz kargo limiti kapanır.
              </small>
            </label>
          </div>
          <button
            className="admin-primary-button"
            type="submit"
            disabled={shippingSaving}
          >
            {shippingSaving ? "Kaydediliyor…" : "Kargo ayarlarını kaydet"}
          </button>
        </form>
      )}

      <section className="admin-payment-guidance">
        <div>
          <span>01</span>
          <strong>Sağlayıcı hesabı</strong>
          <p>Başvuru ve banka hesabı işletme sahibi adına tamamlanır.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Güvenli bağlantı</strong>
          <p>API bilgileri bu ekrandan bir kez girilir ve şifrelenir.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Gerçek test</strong>
          <p>Canlı satıştan önce düşük tutarlı bir sipariş doğrulanır.</p>
        </div>
      </section>

      {selected && (
        <div
          className="admin-payment-drawer-backdrop"
          role="presentation"
          onMouseDown={() => !saving && setSelectedId(null)}
        >
          <form
            className="admin-payment-drawer"
            onSubmit={saveProvider}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className={`payment-mark ${selected.id}`}>
                  {providerMarks[selected.id]}
                </span>
                <div>
                  <p>Ödeme yöntemi</p>
                  <h2>{selected.name}</h2>
                </div>
              </div>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setSelectedId(null)}
                disabled={saving}
              >
                ×
              </button>
            </header>

            <div className="admin-payment-drawer-body">
              <div className="payment-secret-note">
                <span aria-hidden="true">◆</span>
                <p>
                  Kayıtlı değerler tekrar gösterilmez. Bir alanı boş bırakırsanız
                  mevcut değer korunur.
                </p>
              </div>

              <div className="admin-field-grid">
                {selected.fields.map((field) => (
                  <label className="admin-field full" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type={field.secret ? "password" : "text"}
                      value={credentials[field.key] ?? ""}
                      onChange={(event) =>
                        setCredentials((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={
                        selected.configured
                          ? `${selected.credentialHint || "Kayıtlı"} · değiştirmek için yeni değer girin`
                          : field.placeholder
                      }
                      autoComplete="off"
                    />
                  </label>
                ))}
              </div>

              <div className="payment-switches">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        enabled: event.target.checked,
                        isPrimary: event.target.checked
                          ? current.isPrimary
                          : false,
                      }))
                    }
                  />
                  <span>
                    <strong>Ödeme yöntemini etkinleştir</strong>
                    <small>Ödeme ekranında müşterilere gösterilir.</small>
                  </span>
                </label>
                {selected.supportsTestMode && (
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.testMode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          testMode: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>Test modu</strong>
                      <small>Gerçek tahsilat yapmadan entegrasyonu sınar.</small>
                    </span>
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={draft.isPrimary}
                    disabled={!draft.enabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isPrimary: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Birincil yöntem yap</strong>
                    <small>Ödeme ekranında ilk seçenek olarak gelir.</small>
                  </span>
                </label>
              </div>

              <div className="payment-callback">
                <span>Bildirim adresi</span>
                <div>
                  <code>{callbackUrl}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(callbackUrl);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    }}
                  >
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <small>
                  Bu adresi {selected.name} hesabındaki bildirim veya callback
                  alanına ekleyin.
                </small>
              </div>
            </div>

            <footer>
              {selected.configured && (
                <button
                  className="payment-disconnect"
                  type="button"
                  onClick={() => void disconnectProvider()}
                  disabled={saving}
                >
                  Bağlantıyı kaldır
                </button>
              )}
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => setSelectedId(null)}
                disabled={saving}
              >
                Vazgeç
              </button>
              <button
                className="admin-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Güvenle kaydediliyor…" : "Ayarları kaydet"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
