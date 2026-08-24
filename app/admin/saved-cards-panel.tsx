"use client";

import { useEffect, useMemo, useState } from "react";

type SavedPaymentMethod = {
  id: number;
  userId: number;
  provider: string;
  tokenPreview: string;
  cardholderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
  customerName?: string;
  customerEmail?: string;
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  return body;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function SavedCardsPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadPaymentMethods = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/payment-methods", { cache: "no-store" }),
      );
      setPaymentMethods(
        (body.paymentMethods as SavedPaymentMethod[] | undefined) ?? [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Kayıtlı kartlar alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The protected API hydrates this panel from the durable store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPaymentMethods();
  }, []);

  const filteredMethods = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return paymentMethods;
    return paymentMethods.filter((method) =>
      [
        method.customerName,
        method.customerEmail,
        method.cardholderName,
        method.brand,
        method.last4,
        method.provider,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [paymentMethods, query]);

  const deleteMethod = async (method: SavedPaymentMethod) => {
    if (!window.confirm(`•••• ${method.last4} kayıtlı kartı silinsin mi?`)) {
      return;
    }
    setDeletingId(method.id);
    setError("");
    try {
      await readJson(
        await fetch(`/api/admin/payment-methods/${method.id}`, {
          method: "DELETE",
        }),
      );
      setPaymentMethods((current) =>
        current.filter((item) => item.id !== method.id),
      );
      onNotice("Kayıtlı kart silindi.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Kart silinemedi.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-workbench">
      <section className="admin-stat-grid compact">
        <article>
          <span>Kayıtlı kart</span>
          <strong>{paymentMethods.length}</strong>
          <small>Tokenlı ödeme yöntemi</small>
        </article>
        <article>
          <span>Varsayılan</span>
          <strong>{paymentMethods.filter((method) => method.isDefault).length}</strong>
          <small>Müşteri seçimi</small>
        </article>
        <article>
          <span>Sağlayıcı</span>
          <strong>
            {new Set(paymentMethods.map((method) => method.provider)).size}
          </strong>
          <small>Kaynak sistem</small>
        </article>
        <article>
          <span>Güvenlik</span>
          <strong>0</strong>
          <small>Tam kart / CVV kaydı</small>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Kart kasası</p>
            <h2>Kayıtlı kartlar</h2>
          </div>
          <button type="button" onClick={loadPaymentMethods}>
            Yenile
          </button>
        </div>

        <div className="admin-secure-note">
          Admin paneli tam kart numarası veya CVV göstermez. Burada sadece
          token ön izlemesi, kart markası, son 4 hane ve müşteri bilgisi görünür.
        </div>

        {error && <div className="admin-inline-error">{error}</div>}

        <div className="admin-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Müşteri, e-posta, marka veya son 4 hane ara"
          />
        </div>

        {loading ? (
          <div className="admin-empty small">Kayıtlı kartlar hazırlanıyor...</div>
        ) : (
          <div className="admin-data-table saved-cards">
            <div className="admin-data-head">
              <span>Müşteri</span>
              <span>Kart</span>
              <span>Son kullanım</span>
              <span>Sağlayıcı</span>
              <span>Token</span>
              <span>İşlem</span>
            </div>
            {filteredMethods.map((method) => (
              <div className="admin-data-row" key={method.id}>
                <span>
                  <strong>{method.customerName || method.cardholderName}</strong>
                  <small>{method.customerEmail}</small>
                </span>
                <span>
                  <strong>{method.brand.toLocaleUpperCase("tr-TR")}</strong>
                  <small>•••• {method.last4}</small>
                  {method.isDefault && <b className="admin-pill good">Varsayılan</b>}
                </span>
                <span>
                  {method.expMonth.toString().padStart(2, "0")}/{method.expYear}
                  <small>{formatDate(method.createdAt)}</small>
                </span>
                <span>{method.provider}</span>
                <span>
                  <code>{method.tokenPreview}</code>
                </span>
                <span>
                  <button
                    className="admin-danger-button"
                    type="button"
                    disabled={deletingId === method.id}
                    onClick={() => deleteMethod(method)}
                  >
                    Sil
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
