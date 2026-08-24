"use client";

import { useEffect, useState } from "react";

type AlertTarget = "shipping" | "products" | "customers" | "reports";

type AdminAlert = {
  id: string;
  tone: "danger" | "warning" | "muted" | "good";
  title: string;
  value: number;
  description: string;
  target: AlertTarget;
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  return body;
}

export default function OperationsPanel({
  onNavigate,
}: {
  onNavigate: (target: AlertTarget) => void;
}) {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/alerts", { cache: "no-store" }),
      );
      setAlerts((body.alerts as AdminAlert[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Operasyon uyarıları alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The protected API hydrates this panel from the durable store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAlerts();
  }, []);

  return (
    <div className="admin-workbench">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Günlük iş takibi</p>
            <h2>Operasyon merkezi</h2>
          </div>
          <button type="button" onClick={loadAlerts}>
            Yenile
          </button>
        </div>

        {error && <div className="admin-inline-error">{error}</div>}

        {loading ? (
          <div className="admin-empty small">Uyarılar hazırlanıyor...</div>
        ) : (
          <div className="admin-alert-grid">
            {alerts.map((alert) => (
              <article className={`admin-alert-card ${alert.tone}`} key={alert.id}>
                <span>{alert.title}</span>
                <strong>{alert.value}</strong>
                <p>{alert.description}</p>
                <button type="button" onClick={() => onNavigate(alert.target)}>
                  İlgili ekrana git
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-panel admin-priority-panel">
        <p className="admin-kicker">Önerilen sıra</p>
        <h2>Bugünkü kontrol listesi</h2>
        <ol>
          <li>Kargoya hazırlanacak siparişleri kapat.</li>
          <li>Stok 3 ve altı ürünleri kontrol et.</li>
          <li>Ödeme bekleyen siparişlerde hata var mı bak.</li>
          <li>Yeni üyelerin doğrulama durumunu incele.</li>
        </ol>
      </section>
    </div>
  );
}
