"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SystemTestDashboard,
  SystemTestRun,
} from "../../lib/system-test-types";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function formatCents(value: number) {
  return money.format(value / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readJson(response: Response) {
  if (response.status === 204) return {};
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function SystemTestCenter({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [data, setData] = useState<SystemTestDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState("shopier");
  const [scenario, setScenario] = useState("success");
  const [discountCode, setDiscountCode] = useState("");
  const [result, setResult] = useState<SystemTestRun | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system-tests", {
        cache: "no-store",
      });
      const body = await readJson(response);
      const dashboard = body as unknown as SystemTestDashboard;
      setData(dashboard);
      setProductId((current) => {
        if (current) return current;
        return String(dashboard.products[0]?.id ?? "");
      });
      setProvider(
        (current) =>
          dashboard.providers.find((item) => item.id === current)?.id ??
          dashboard.providers.find((item) => item.isPrimary)?.id ??
          dashboard.providers[0]?.id ??
          "shopier",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Test merkezi yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load the protected diagnostic dashboard once the panel is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const healthSummary = useMemo(() => {
    const checks = data?.checks ?? [];
    return {
      passed: checks.filter((check) => check.status === "passed").length,
      warning: checks.filter((check) => check.status === "warning").length,
      failed: checks.filter((check) => check.status === "failed").length,
    };
  }, [data]);

  const runPurchaseSimulation = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/system-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "simulate-purchase",
          productId: Number(productId),
          quantity,
          provider,
          scenario,
          discountCode,
        }),
      });
      const body = await readJson(response);
      const run = body.run as SystemTestRun;
      setResult(run);
      onNotice("Satın alma simülasyonu tamamlandı.");
      await load();
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Satın alma simülasyonu tamamlanamadı.",
      );
    } finally {
      setRunning(false);
    }
  };

  const sendTestEmail = async () => {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send-email" }),
      });
      await readJson(response);
      onNotice("Test e-postası yönetici adresine gönderildi.");
      await load();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Test e-postası gönderilemedi.",
      );
      await load();
    } finally {
      setRunning(false);
    }
  };

  const clearHistory = async () => {
    setRunning(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/admin/system-tests", { method: "DELETE" }),
      );
      setResult(null);
      onNotice("Test geçmişi temizlendi.");
      await load();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Test geçmişi temizlenemedi.",
      );
    } finally {
      setRunning(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="admin-test-loading">
        Sistem bağlantıları kontrol ediliyor…
      </div>
    );
  }

  return (
    <div className="admin-test-center">
      <section className="admin-test-hero">
        <div>
          <p>Canlıya geçiş kontrolü</p>
          <h2>Sistem Test Merkezi</h2>
          <span>
            Gerçek sipariş veya stok değişikliği oluşturmadan mağaza
            bağlantılarını ve satın alma akışını kontrol edin.
          </span>
        </div>
        <div className="admin-test-score">
          <strong>
            {healthSummary.passed}
            <small> / {data?.checks.length ?? 0}</small>
          </strong>
          <span>Hazır bağlantı</span>
          <button type="button" disabled={loading} onClick={() => void load()}>
            {loading ? "Kontrol ediliyor…" : "Yeniden kontrol et"}
          </button>
        </div>
      </section>

      {error && <div className="admin-inline-error">{error}</div>}

      <section className="admin-test-health">
        <header>
          <div>
            <p>Kurulum durumu</p>
            <h3>Bağlantı kontrolleri</h3>
          </div>
          <span>
            {healthSummary.failed > 0
              ? `${healthSummary.failed} kritik eksik`
              : healthSummary.warning > 0
                ? `${healthSummary.warning} ayar bekliyor`
                : "Tüm kontroller hazır"}
          </span>
        </header>
        <div className="admin-test-health-grid">
          {data?.checks.map((check) => (
            <article className={check.status} key={check.id}>
              <i aria-hidden="true">
                {check.status === "passed"
                  ? "✓"
                  : check.status === "warning"
                    ? "!"
                    : "×"}
              </i>
              <div>
                <strong>{check.label}</strong>
                <p>{check.summary}</p>
                {check.action && <small>{check.action}</small>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-test-layout">
        <form
          className="admin-test-simulator"
          onSubmit={runPurchaseSimulation}
        >
          <header>
            <p>Güvenli prova</p>
            <h3>Satın alma simülasyonu</h3>
            <span>
              Fiyat, indirim, kargo, ödeme sonucu ve stok korumasını tek akışta
              kontrol eder.
            </span>
          </header>

          <label>
            <span>Test ürünü</span>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
            >
              {data?.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.stock} stok
                </option>
              ))}
            </select>
          </label>

          <div className="admin-test-field-row">
            <label>
              <span>Adet</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <label>
              <span>Ödeme yöntemi</span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {data?.providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.configured && item.enabled ? " · hazır" : " · ayar bekliyor"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span>Senaryo</span>
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              <option value="success">Başarılı ödeme</option>
              <option value="failed-payment">Başarısız ödeme</option>
            </select>
          </label>

          <label>
            <span>İndirim kodu · isteğe bağlı</span>
            <input
              value={discountCode}
              onChange={(event) =>
                setDiscountCode(event.target.value.toUpperCase())
              }
              placeholder="Örn. HOSGELDIN20"
            />
          </label>

          <button
            className="admin-primary-button"
            type="submit"
            disabled={running || !productId}
          >
            {running ? "Simülasyon çalışıyor…" : "Simülasyonu başlat"}
          </button>
          <small className="admin-test-safe-note">
            Gerçek ödeme alınmaz, sipariş oluşturulmaz ve stok düşmez.
          </small>
        </form>

        <section className="admin-test-result">
          <header>
            <p>Son test</p>
            <h3>{result ? result.testId : "Henüz test çalıştırılmadı"}</h3>
            <span>
              {result?.summary ??
                "Soldaki formdan bir senaryo seçerek tüm adımları görün."}
            </span>
          </header>
          {result?.details.quote && (
            <div className="admin-test-quote">
              <div>
                <span>Ara toplam</span>
                <b>{formatCents(result.details.quote.subtotalAmount)}</b>
              </div>
              <div>
                <span>İndirim</span>
                <b>−{formatCents(result.details.quote.discountAmount)}</b>
              </div>
              <div>
                <span>KDV (%20)</span>
                <b>{formatCents(result.details.quote.vatAmount)}</b>
              </div>
              <div>
                <span>Kargo</span>
                <b>{formatCents(result.details.quote.shippingAmount)}</b>
              </div>
              <div>
                <span>Test toplamı</span>
                <b>{formatCents(result.details.quote.totalAmount)}</b>
              </div>
            </div>
          )}
          <div className="admin-test-steps">
            {result?.details.steps?.map((step) => (
              <div className={step.status} key={step.id}>
                <i aria-hidden="true">
                  {step.status === "passed"
                    ? "✓"
                    : step.status === "warning"
                      ? "!"
                      : "×"}
                </i>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-test-email">
        <div>
          <p>E-posta teslimatı</p>
          <h3>Gerçek test e-postası</h3>
          <span>
            Resend bağlantısını yönetici hesabınıza tek bir deneme e-postası
            göndererek kontrol edin.
          </span>
        </div>
        <button
          type="button"
          className="admin-secondary-button"
          disabled={running}
          onClick={() => void sendTestEmail()}
        >
          Test e-postası gönder
        </button>
      </section>

      <section className="admin-test-history">
        <header>
          <div>
            <p>Denetim kaydı</p>
            <h3>Test geçmişi</h3>
          </div>
          <button
            type="button"
            disabled={running || !data?.runs.length}
            onClick={() => void clearHistory()}
          >
            Geçmişi temizle
          </button>
        </header>
        {data?.runs.length ? (
          <div className="admin-test-history-table">
            {data.runs.map((run) => (
              <article key={run.id || run.testId}>
                <i className={run.status} aria-hidden="true">
                  {run.status === "passed" ? "✓" : "×"}
                </i>
                <div>
                  <strong>{run.testId}</strong>
                  <small>
                    {run.kind === "purchase"
                      ? "Satın alma simülasyonu"
                      : "E-posta testi"}
                  </small>
                </div>
                <span>{run.summary}</span>
                <time>{formatDate(run.createdAt)}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-test-empty">
            Çalıştırılan testler burada görüntülenecek.
          </div>
        )}
      </section>
    </div>
  );
}
