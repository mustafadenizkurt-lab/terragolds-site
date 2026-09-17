"use client";

import { useEffect, useState } from "react";

type BirfaturaStatus = {
  enabled: boolean;
  configured: boolean;
  updatedAt: string | null;
};

// BirFatura (veya "Kendi Altyapım" ile bağlanan başka bir e-fatura/pazaryeri
// entegratörü) bizim sitemize DIŞARIDAN istek atıyor - Trendyol/Hepsiburada'nın
// tersi yönde. Bu yüzden burada admin panelinden bir API anahtarı üretilip
// BirFatura'nın "API Şifresi" alanına girilmesi gerekiyor.
export default function BirfaturaPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [status, setStatus] = useState<BirfaturaStatus | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/birfatura", { cache: "no-store" });
      const body = (await response.json()) as BirfaturaStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Durum alınamadı.");
      setStatus(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Durum alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const generateKey = async () => {
    if (
      status?.configured &&
      !window.confirm(
        "Yeni bir anahtar üretmek eskisini geçersiz kılar - BirFatura'daki kayıtlı anahtarı da güncellemeniz gerekir. Devam edilsin mi?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNewApiKey("");
    try {
      const response = await fetch("/api/admin/birfatura", { method: "POST" });
      const body = (await response.json()) as {
        apiKey?: string;
        status?: BirfaturaStatus;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Anahtar üretilemedi.");
      setNewApiKey(body.apiKey ?? "");
      setStatus(body.status ?? null);
      onNotice("Yeni BirFatura API anahtarı üretildi.");
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Anahtar üretilemedi.",
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!window.confirm("BirFatura erişimi kapatılsın mı? Mevcut anahtar geçersiz olur.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/birfatura", { method: "DELETE" });
      const body = (await response.json()) as { status?: BirfaturaStatus; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Erişim kapatılamadı.");
      setStatus(body.status ?? null);
      setNewApiKey("");
      onNotice("BirFatura erişimi kapatıldı.");
    } catch (disableError) {
      setError(
        disableError instanceof Error ? disableError.message : "Erişim kapatılamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  const ordersUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/birfatura/orders` : "";

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">BirFatura / Kendi Altyapım</p>
          <h2>Sipariş API erişimi</h2>
          <p>
            BirFatura (veya benzeri bir e-fatura/pazaryeri entegratörü) bu
            adrese bir API anahtarıyla istek atıp sitemizdeki siparişleri
            çekebilir. Trendyol/Hepsiburada&apos;nın tersine, burada istek
            bize dışarıdan geliyor.
          </p>
        </div>
        <span
          className={
            status?.enabled && status.configured
              ? "payment-state active"
              : status?.configured
                ? "payment-state ready"
                : "payment-state"
          }
        >
          {status?.enabled && status.configured
            ? "Etkin"
            : status?.configured
              ? "Kayıtlı ama kapalı"
              : "Kurulum gerekli"}
        </span>
      </div>

      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Durum hazırlanıyor…</p>
        </div>
      ) : (
        <>
          <div className="admin-field-grid">
            <label className="admin-field full">
              <span>Sipariş listesi adresi (BirFatura&apos;daki &quot;Web Sitenizin Adresi&quot; yerine bunu girin)</span>
              <input value={ordersUrl} readOnly onClick={(event) => event.currentTarget.select()} />
            </label>
          </div>

          {newApiKey && (
            <div className="payment-secret-note">
              <span aria-hidden="true">◆</span>
              <div>
                <p>
                  <strong>API Şifresi (sadece şimdi gösteriliyor, bir daha görünmeyecek):</strong>
                </p>
                <code style={{ userSelect: "all", wordBreak: "break-all" }}>{newApiKey}</code>
                <p>
                  Bu değeri kopyalayıp BirFatura&apos;nın &quot;API Şifresi&quot;
                  alanına yapıştırın.
                </p>
              </div>
            </div>
          )}

          <div className="admin-form-actions">
            {status?.configured && (
              <button
                type="button"
                className="payment-disconnect"
                onClick={() => void disable()}
                disabled={busy}
              >
                Erişimi kapat
              </button>
            )}
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => void generateKey()}
              disabled={busy}
            >
              {busy
                ? "Üretiliyor…"
                : status?.configured
                  ? "Yeni anahtar üret"
                  : "API anahtarı üret"}
            </button>
          </div>

          {status?.updatedAt && (
            <p style={{ opacity: 0.6, fontSize: 13 }}>
              Son güncelleme: {status.updatedAt}
            </p>
          )}
        </>
      )}
    </div>
  );
}
