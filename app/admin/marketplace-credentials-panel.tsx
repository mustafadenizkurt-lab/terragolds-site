"use client";

import { useEffect, useState } from "react";

type MarketplaceId = "trendyol" | "hepsiburada" | "n11";

type FieldDefinition = {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
  required: boolean;
};

type MarketplaceSummary = {
  id: MarketplaceId;
  name: string;
  shortDescription: string;
  fields: FieldDefinition[];
  enabled: boolean;
  configured: boolean;
  credentialHint: string;
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

// PaymentProvidersPanel ile aynı desen: kimlik bilgileri admin panelinden
// bir kez girilir, sunucu tarafında şifrelenip D1'e yazılır ve bir daha
// tarayıcıya geri gönderilmez. wrangler CLI/Worker secret gerekmiyor.
export default function MarketplaceCredentialsPanel({
  provider,
  onNotice,
}: {
  provider: MarketplaceId;
  onNotice: (message: string) => void;
}) {
  const [summary, setSummary] = useState<MarketplaceSummary | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/marketplace-credentials", {
        cache: "no-store",
      });
      const body = await readJson(response);
      const providers = (body.providers as MarketplaceSummary[] | undefined) ?? [];
      const found = providers.find((item) => item.id === provider) ?? null;
      setSummary(found);
      setEnabled(found?.enabled ?? false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Pazaryeri bilgileri alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/marketplace-credentials/${provider}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, credentials }),
      });
      const body = await readJson(response);
      const providers = (body.providers as MarketplaceSummary[] | undefined) ?? [];
      const found = providers.find((item) => item.id === provider) ?? null;
      setSummary(found);
      setEnabled(found?.enabled ?? false);
      setCredentials({});
      onNotice(`${summary?.name ?? "Pazaryeri"} bağlantı bilgileri güvenle kaydedildi.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Pazaryeri bilgileri kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (
      !window.confirm(
        `${summary?.name ?? "Pazaryeri"} bağlantısı ve kayıtlı anahtarları kaldırılacak. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/marketplace-credentials/${provider}`, {
        method: "DELETE",
      });
      const body = await readJson(response);
      const providers = (body.providers as MarketplaceSummary[] | undefined) ?? [];
      const found = providers.find((item) => item.id === provider) ?? null;
      setSummary(found);
      setEnabled(false);
      setCredentials({});
      onNotice(`${found?.name ?? "Pazaryeri"} bağlantısı kaldırıldı.`);
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

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-loading">
          <span />
          <p>Bağlantı bilgileri hazırlanıyor…</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="admin-panel">
        {error && (
          <div className="admin-inline-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

  // credentialHint sadece bu alanın son 4 hanesinden üretiliyor (bkz.
  // lib/marketplace-credentials.ts) - ipucunu SADECE bu alanda göstermek
  // gerekiyor, yoksa her kutuda aynı metin tekrarlanıp kafa karıştırıyor.
  const identifierFieldKey = summary.fields.find((field) => !field.secret)?.key;

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Bağlantı bilgileri</p>
          <h2>{summary.name} API kimlik bilgileri</h2>
          <p>{summary.shortDescription}</p>
        </div>
        <span
          className={
            summary.enabled && summary.configured
              ? "payment-state active"
              : summary.configured
                ? "payment-state ready"
                : "payment-state"
          }
        >
          {summary.enabled && summary.configured
            ? "Etkin"
            : summary.configured
              ? "Kayıtlı"
              : "Kurulum gerekli"}
        </span>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={save}>
        <div className="payment-secret-note">
          <span aria-hidden="true">◆</span>
          <p>
            Kayıtlı değerler tekrar gösterilmez. Bir alanı boş bırakırsanız
            mevcut değer korunur. Anahtarlar şifrelenerek saklanır ve sadece
            sunucu tarafında {summary.name} isteklerinde kullanılır.
          </p>
        </div>

        <div className="admin-field-grid">
          {summary.fields.map((field) => (
            <label className="admin-field" key={field.key}>
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
                  summary.configured
                    ? field.key === identifierFieldKey
                      ? `${summary.credentialHint || "Kayıtlı"} · değiştirmek için yeni değer girin`
                      : "Kayıtlı · değiştirmek için yeni değer girin"
                    : field.placeholder
                }
                autoComplete="off"
              />
            </label>
          ))}
        </div>

        <label className="admin-check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>
            <strong>Senkronu etkinleştir</strong>
            <small>
              Kapalıyken aşağıdaki senkron butonları çalışmaz, bilgiler
              sadece kaydedilmiş olur.
            </small>
          </span>
        </label>

        <div className="admin-form-actions">
          {summary.configured && (
            <button
              type="button"
              className="payment-disconnect"
              onClick={() => void disconnect()}
              disabled={saving}
            >
              Bağlantıyı kaldır
            </button>
          )}
          <button
            type="submit"
            className="admin-primary-button"
            disabled={saving}
          >
            {saving ? "Güvenle kaydediliyor…" : "Bağlantı bilgilerini kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
