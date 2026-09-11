"use client";

import { useEffect, useState } from "react";

type Partner = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  referralCode: string | null;
  commissionRate: number | null;
  createdAt: string;
  customerCount: number;
  orderCount: number;
  revenue: number;
  commissionTotal: number;
};

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  commissionRate: number;
};

const emptyDraft: Draft = { firstName: "", lastName: "", email: "", commissionRate: 10 };

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error((body.error as string) ?? "İşlem tamamlanamadı.");
  return body;
}

export default function PartnersPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/admin/partners", { cache: "no-store" });
      const body = await readJson(response);
      setPartners((body.partners as Partner[]) ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Partner listesi alınamadı.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createPartner = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await readJson(response)) as { referralCode?: string; warning?: string };
      setDraft(emptyDraft);
      await load();
      onNotice(
        body.warning ?? `Partner eklendi, referans kodu: ${body.referralCode}. Davet e-postası gönderildi.`,
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Partner eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const startEditRate = (partner: Partner) => {
    setEditingRateId(partner.id);
    setEditingRateValue(partner.commissionRate ?? 0);
  };

  const saveRate = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      await readJson(
        await fetch(`/api/admin/partners/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ commissionRate: editingRateValue }),
        }),
      );
      setEditingRateId(null);
      await load();
      onNotice("Komisyon oranı güncellendi (yalnızca yeni siparişlere uygulanır).");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Komisyon oranı güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">İş ortakları</p>
          <h2>Partnerler</h2>
          <p>
            Bir partner eklendiğinde otomatik bir referans kodu üretilir ve partnere
            şifresini belirlemesi için bir davet e-postası gönderilir.
          </p>
        </div>
      </div>
      {error && (
        <div className="admin-inline-error" role="alert">
          {error}
        </div>
      )}

      <form className="admin-form" onSubmit={createPartner}>
        <div className="admin-field-grid">
          <label className="admin-field">
            <span>Ad</span>
            <input
              value={draft.firstName}
              onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
              required
            />
          </label>
          <label className="admin-field">
            <span>Soyad</span>
            <input
              value={draft.lastName}
              onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
              required
            />
          </label>
          <label className="admin-field">
            <span>E-posta</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              required
            />
          </label>
          <label className="admin-field">
            <span>Komisyon oranı (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft.commissionRate}
              onChange={(event) =>
                setDraft({ ...draft, commissionRate: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <button className="admin-secondary-button" type="submit" disabled={busy}>
          Partner Ekle
        </button>
      </form>

      <div className="admin-supplier-table-wrap">
        <table className="admin-supplier-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Referans kodu</th>
              <th>Komisyon</th>
              <th>Müşteri</th>
              <th>Sipariş</th>
              <th>Ciro</th>
              <th>Komisyon tutarı</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr key={partner.id}>
                <td>
                  {partner.firstName} {partner.lastName}
                  <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>{partner.email}</div>
                </td>
                <td>{partner.referralCode}</td>
                <td>
                  {editingRateId === partner.id ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editingRateValue}
                        onChange={(event) => setEditingRateValue(Number(event.target.value))}
                        style={{ width: 70 }}
                      />
                      <button type="button" disabled={busy} onClick={() => void saveRate(partner.id)}>
                        Kaydet
                      </button>
                      <button type="button" onClick={() => setEditingRateId(null)}>
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <>
                      %{partner.commissionRate ?? 0}{" "}
                      <button type="button" onClick={() => startEditRate(partner)}>
                        Düzenle
                      </button>
                    </>
                  )}
                </td>
                <td>{partner.customerCount}</td>
                <td>{partner.orderCount}</td>
                <td>{money.format(partner.revenue / 100)}</td>
                <td>{money.format(partner.commissionTotal / 100)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        {!partners.length && <p className="admin-empty">Henüz partner eklenmedi.</p>}
      </div>
    </div>
  );
}
