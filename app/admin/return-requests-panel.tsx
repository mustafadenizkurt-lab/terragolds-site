"use client";

import { useEffect, useState } from "react";

type ReturnRequest = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  productDescription: string;
  trackingNumber: string;
  reason: string;
  iban: string;
  status: string;
  adminNote: string;
  createdAt: string;
};

const statusLabels: Record<string, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  completed: "Tamamlandı",
};

const statusOptions = Object.keys(statusLabels);

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function ReturnRequestsPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/return-requests", { cache: "no-store" }),
      );
      const rows = (body.returnRequests as ReturnRequest[] | undefined) ?? [];
      setRequests(rows);
      setNoteDrafts(
        Object.fromEntries(rows.map((row) => [row.id, row.adminNote])),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "İade talepleri alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const updateRequest = async (
    request: ReturnRequest,
    status: string,
    adminNote: string,
  ) => {
    setSavingId(request.id);
    setError("");
    try {
      const body = await readJson(
        await fetch(`/api/admin/return-requests/${request.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status, adminNote }),
        }),
      );
      setRequests((body.returnRequests as ReturnRequest[]) ?? []);
      onNotice("İade talebi güncellendi.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "İade talebi güncellenemedi.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-discounts admin-return-requests">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">Müşteri hizmetleri</p>
          <h2>İade talep formundan gelen başvurular.</h2>
          <p>
            "İptal ve İade Koşulları" sayfasındaki formdan gönderilen talepler
            burada listelenir; durumunu güncelleyip not ekleyebilirsiniz.
          </p>
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
          <p>İade talepleri hazırlanıyor…</p>
        </div>
      ) : requests.length ? (
        <div className="admin-return-request-list">
          {requests.map((request) => {
            const saving = savingId === request.id;
            return (
              <article key={request.id} className="admin-return-request-card">
                <header>
                  <div>
                    <strong>{request.fullName}</strong>
                    <span>{request.email} · {request.phone}</span>
                  </div>
                  <span className={`return-state ${request.status}`}>
                    {statusLabels[request.status] ?? request.status}
                  </span>
                </header>
                <dl>
                  <div>
                    <dt>Sipariş Numarası</dt>
                    <dd>{request.orderNumber}</dd>
                  </div>
                  <div>
                    <dt>İade Edilen Ürün(ler)</dt>
                    <dd>{request.productDescription}</dd>
                  </div>
                  <div>
                    <dt>Kargo Takip Numarası</dt>
                    <dd>{request.trackingNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt>İade Nedeni</dt>
                    <dd>{request.reason || "—"}</dd>
                  </div>
                  <div>
                    <dt>IBAN</dt>
                    <dd>{request.iban || "—"}</dd>
                  </div>
                  <div>
                    <dt>Talep tarihi</dt>
                    <dd>{dateFormatter.format(new Date(request.createdAt))}</dd>
                  </div>
                </dl>
                <div className="admin-return-request-actions">
                  <label className="admin-field">
                    <span>Durum</span>
                    <select
                      value={request.status}
                      disabled={saving}
                      onChange={(event) =>
                        void updateRequest(
                          request,
                          event.target.value,
                          noteDrafts[request.id] ?? request.adminNote,
                        )
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field full">
                    <span>Not</span>
                    <input
                      value={noteDrafts[request.id] ?? ""}
                      disabled={saving}
                      onChange={(event) =>
                        setNoteDrafts({
                          ...noteDrafts,
                          [request.id]: event.target.value,
                        })
                      }
                      onBlur={() =>
                        void updateRequest(
                          request,
                          request.status,
                          noteDrafts[request.id] ?? "",
                        )
                      }
                      placeholder="Dahili not (opsiyonel)"
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty">
          <span>↺</span>
          <h2>Henüz iade talebi yok</h2>
          <p>Müşteriler form gönderdiğinde burada görünecek.</p>
        </div>
      )}
    </div>
  );
}
