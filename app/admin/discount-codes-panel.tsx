"use client";

import { useEffect, useState } from "react";

type DiscountCode = {
  id: number;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumOrderAmount: number;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
};

type DiscountDraft = {
  id?: number;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  minimumOrderAmount: string;
  usageLimit: string;
  active: boolean;
  startsAt: string;
  expiresAt: string;
};

const emptyDraft: DiscountDraft = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "10",
  minimumOrderAmount: "0",
  usageLimit: "0",
  active: true,
  startsAt: "",
  expiresAt: "",
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

function localDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function DiscountCodesPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [draft, setDraft] = useState<DiscountDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCodes = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/discount-codes", { cache: "no-store" }),
      );
      setCodes((body.discountCodes as DiscountCode[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "İndirim kodları alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCodes();
  }, []);

  const editCode = (code: DiscountCode) => {
    setDraft({
      id: code.id,
      code: code.code,
      description: code.description,
      discountType: code.discountType,
      discountValue:
        code.discountType === "fixed"
          ? String(code.discountValue / 100)
          : String(code.discountValue),
      minimumOrderAmount: String(code.minimumOrderAmount / 100),
      usageLimit: String(code.usageLimit),
      active: code.active,
      startsAt: localDateInput(code.startsAt),
      expiresAt: localDateInput(code.expiresAt),
    });
    setError("");
  };

  const saveCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        draft.id
          ? `/api/admin/discount-codes/${draft.id}`
          : "/api/admin/discount-codes",
        {
          method: draft.id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...draft,
            discountValue: Number(draft.discountValue),
            minimumOrderAmount: Number(draft.minimumOrderAmount),
            usageLimit: Number(draft.usageLimit),
          }),
        },
      );
      const body = await readJson(response);
      setCodes(body.discountCodes as DiscountCode[]);
      setDraft(null);
      onNotice(draft.id ? "İndirim kodu güncellendi." : "İndirim kodu oluşturuldu.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "İndirim kodu kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCode = async (code: DiscountCode) => {
    if (!window.confirm(`${code.code} kodu silinsin mi?`)) return;
    setSaving(true);
    setError("");
    try {
      const body = await readJson(
        await fetch(`/api/admin/discount-codes/${code.id}`, {
          method: "DELETE",
        }),
      );
      setCodes(body.discountCodes as DiscountCode[]);
      onNotice("İndirim kodu silindi.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "İndirim kodu silinemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-discounts">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">Kampanya yönetimi</p>
          <h2>Sepete özel indirim kodları oluşturun.</h2>
          <p>
            Yüzde veya sabit tutarlı indirim; minimum sepet, kullanım adedi ve
            tarih sınırıyla güvenli biçimde uygulanır.
          </p>
        </div>
        <button
          className="admin-primary-button"
          type="button"
          onClick={() => setDraft({ ...emptyDraft })}
        >
          ＋ Yeni indirim kodu
        </button>
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
          <p>İndirim kodları hazırlanıyor…</p>
        </div>
      ) : codes.length ? (
        <div className="admin-discount-list">
          {codes.map((code) => {
            return (
              <article key={code.id}>
                <div className="admin-discount-code">
                  <strong>{code.code}</strong>
                  <span
                    className={
                      code.active
                        ? "discount-state active"
                        : "discount-state"
                    }
                  >
                    {code.active ? "Etkin" : "Pasif"}
                  </span>
                </div>
                <div>
                  <b>
                    {code.discountType === "percent"
                      ? `%${code.discountValue}`
                      : money.format(code.discountValue / 100)}
                  </b>
                  <small>
                    {code.minimumOrderAmount
                      ? `En az ${money.format(code.minimumOrderAmount / 100)}`
                      : "Minimum sepet yok"}
                  </small>
                </div>
                <div>
                  <b>
                    {code.usedCount}
                    {code.usageLimit ? ` / ${code.usageLimit}` : ""}
                  </b>
                  <small>Kullanım</small>
                </div>
                <div className="admin-discount-actions">
                  <button type="button" onClick={() => editCode(code)}>
                    Düzenle
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={() => void deleteCode(code)}
                    disabled={saving}
                  >
                    Sil
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty">
          <span>％</span>
          <h2>Henüz indirim kodu yok</h2>
          <p>İlk kampanyanızı oluşturduğunuzda burada görünecek.</p>
          <button type="button" onClick={() => setDraft({ ...emptyDraft })}>
            İndirim kodu oluştur
          </button>
        </div>
      )}

      {draft && (
        <div
          className="admin-payment-drawer-backdrop"
          role="presentation"
          onMouseDown={() => !saving && setDraft(null)}
        >
          <form
            className="admin-payment-drawer admin-discount-drawer"
            onSubmit={saveCode}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="discount-drawer-mark">％</span>
                <div>
                  <p>Kampanya</p>
                  <h2>{draft.id ? "İndirim kodunu düzenle" : "Yeni indirim kodu"}</h2>
                </div>
              </div>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setDraft(null)}
              >
                ×
              </button>
            </header>
            <div className="admin-payment-drawer-body">
              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>İndirim kodu</span>
                  <input
                    value={draft.code}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        code: event.target.value.toUpperCase().replace(/\s/g, ""),
                      })
                    }
                    placeholder="TERRA20"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>İndirim türü</span>
                  <select
                    value={draft.discountType}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        discountType: event.target.value as "percent" | "fixed",
                      })
                    }
                  >
                    <option value="percent">Yüzde (%)</option>
                    <option value="fixed">Sabit tutar (TL)</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>
                    {draft.discountType === "percent"
                      ? "İndirim oranı"
                      : "İndirim tutarı (TL)"}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={draft.discountType === "percent" ? 90 : undefined}
                    step={draft.discountType === "percent" ? "1" : "0.01"}
                    value={draft.discountValue}
                    onChange={(event) =>
                      setDraft({ ...draft, discountValue: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Minimum sepet (TL)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.minimumOrderAmount}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        minimumOrderAmount: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>Kullanım limiti</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.usageLimit}
                    onChange={(event) =>
                      setDraft({ ...draft, usageLimit: event.target.value })
                    }
                  />
                  <small>Limitsiz kullanım için 0 bırakın.</small>
                </label>
                <label className="admin-field">
                  <span>Açıklama</span>
                  <input
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                    placeholder="Yeni müşterilere özel"
                  />
                </label>
                <label className="admin-field">
                  <span>Başlangıç</span>
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(event) =>
                      setDraft({ ...draft, startsAt: event.target.value })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span>Bitiş</span>
                  <input
                    type="datetime-local"
                    value={draft.expiresAt}
                    onChange={(event) =>
                      setDraft({ ...draft, expiresAt: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="admin-discount-toggle">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                />
                <span>
                  <strong>Kodu etkinleştir</strong>
                  <small>Müşteriler bu kodu sepette kullanabilir.</small>
                </span>
              </label>
            </div>
            <footer>
              <button
                className="admin-secondary-button"
                type="button"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Vazgeç
              </button>
              <button
                className="admin-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Kaydediliyor…" : "İndirim kodunu kaydet"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
