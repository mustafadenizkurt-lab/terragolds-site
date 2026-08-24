"use client";

import { useEffect, useState } from "react";
import {
  defaultShippingTrackingSettings,
  type ShippingTrackingSettings,
} from "../../lib/shipping-tracking-types";

type TrackingDraft = ShippingTrackingSettings & {
  apiKey: string;
  accountCode: string;
};

async function readResponse(response: Response) {
  const body = (await response.json()) as {
    settings?: ShippingTrackingSettings;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || "Kargo takip ayarları alınamadı.");
  }
  return body;
}

export default function ShippingTrackingSettingsPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [draft, setDraft] = useState<TrackingDraft>({
    ...defaultShippingTrackingSettings,
    apiKey: "",
    accountCode: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/shipping-settings", { cache: "no-store" })
      .then(readResponse)
      .then((body) =>
        setDraft({
          ...(body.settings ?? defaultShippingTrackingSettings),
          apiKey: "",
          accountCode: "",
        }),
      )
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Kargo takip ayarları alınamadı.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = await readResponse(
        await fetch("/api/admin/shipping-settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      setDraft({
        ...(body.settings ?? defaultShippingTrackingSettings),
        apiKey: "",
        accountCode: "",
      });
      onNotice("Kargo takip ayarları kaydedildi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Kargo takip ayarları kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-panel admin-tracking-settings">
      <div className="admin-form-section-title">
        <span>05</span>
        <div>
          <h2>Teslimat ve takip</h2>
          <p>
            Manuel teslimat işlemini yönetin, ileride kullanılacak kargo API
            bağlantısını şimdiden hazırlayın.
          </p>
        </div>
        {!loading && (
          <em
            className={
              draft.automaticTrackingEnabled && draft.configured
                ? "configured"
                : ""
            }
          >
            {draft.automaticTrackingEnabled
              ? draft.configured
                ? "API hazır"
                : "Bilgi bekliyor"
              : "Manuel takip"}
          </em>
        )}
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-tracking-loading">Ayarlar hazırlanıyor…</div>
      ) : (
        <>
          <div className="admin-tracking-switches">
            <label>
              <input
                type="checkbox"
                checked={draft.manualDeliveryEnabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    manualDeliveryEnabled: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Manuel teslimat onayı</strong>
                <small>
                  Kargodaki siparişlerde “Teslim edildi” düğmesini gösterir.
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.automaticTrackingEnabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    automaticTrackingEnabled: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Otomatik kargo takibini hazırla</strong>
                <small>
                  Açıldığında kargo firmasının API bağlantı alanları görünür.
                </small>
              </span>
            </label>
          </div>

          {draft.automaticTrackingEnabled && (
            <div className="admin-tracking-api">
              <div className="admin-tracking-api-intro">
                <span aria-hidden="true">◆</span>
                <p>
                  Kargo firmanız API bilgilerini verdiğinde bu alanları
                  doldurabilirsiniz. Gizli anahtar kaydedildikten sonra tekrar
                  gösterilmez.
                </p>
              </div>
              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>Kargo firması / entegrasyon adı</span>
                  <input
                    value={draft.providerName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        providerName: event.target.value,
                      }))
                    }
                    placeholder="Örn. Yurtiçi Kargo"
                  />
                </label>
                <label className="admin-field">
                  <span>API adresi</span>
                  <input
                    type="url"
                    value={draft.apiBaseUrl}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        apiBaseUrl: event.target.value,
                      }))
                    }
                    placeholder="https://api.kargofirmasi.com/..."
                  />
                </label>
                <label className="admin-field">
                  <span>Müşteri / entegrasyon kodu</span>
                  <input
                    value={draft.accountCode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        accountCode: event.target.value,
                      }))
                    }
                    placeholder={
                      draft.configured
                        ? "Kayıtlı · değiştirmek için yeni değer girin"
                        : "Kargo firmasının verdiği kod"
                    }
                    autoComplete="off"
                  />
                </label>
                <label className="admin-field">
                  <span>API anahtarı</span>
                  <input
                    type="password"
                    value={draft.apiKey}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder={
                      draft.configured
                        ? `${draft.credentialHint || "Kayıtlı"} · değiştirmek için yeni anahtar girin`
                        : "Gizli API anahtarı"
                    }
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <small className="admin-tracking-footnote">
                Firma seçildikten sonra, o firmanın teknik istek ve cevap
                formatına uygun otomatik kontrol bağlantısı ayrıca
                etkinleştirilir.
              </small>
            </div>
          )}

          <button
            className="admin-primary-button admin-tracking-save"
            type="button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Kaydediliyor…" : "Teslimat ayarlarını kaydet"}
          </button>
        </>
      )}
    </section>
  );
}
