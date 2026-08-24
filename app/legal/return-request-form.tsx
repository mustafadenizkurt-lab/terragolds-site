"use client";

import { useState } from "react";

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  productDescription: string;
  trackingNumber: string;
  reason: string;
  iban: string;
};

const emptyDraft: Draft = {
  fullName: "",
  email: "",
  phone: "",
  orderNumber: "",
  productDescription: "",
  trackingNumber: "",
  reason: "",
  iban: "",
};

export default function ReturnRequestForm() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const field = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setDraft({ ...draft, [key]: event.target.value }),
  });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/returns/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Talep gönderilemedi.");
      }
      setSent(true);
      setDraft(emptyDraft);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Talep gönderilemedi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="return-request-form return-request-sent">
        <h2>Talebiniz alındı</h2>
        <p>
          İade talebiniz kaydedildi. Belirttiğiniz e-posta adresine bir onay
          gönderdik, ekibimiz en kısa sürede sizinle iletişime geçecektir.
        </p>
        <button
          type="button"
          className="button button-dark"
          onClick={() => setSent(false)}
        >
          Yeni talep oluştur
        </button>
      </div>
    );
  }

  return (
    <div className="return-request-form">
      <h2>İade Talep Formu</h2>
      <p>
        Cayma hakkınızı kullanmak veya iade talebinde bulunmak için aşağıdaki
        formu doldurun. Talebiniz ekibimize iletilecek ve size dönüş
        yapılacaktır.
      </p>
      {error && (
        <div className="return-request-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <div className="return-request-fields">
          <label className="return-request-field">
            <span>Ad Soyad *</span>
            <input required maxLength={120} {...field("fullName")} />
          </label>
          <label className="return-request-field">
            <span>E-posta *</span>
            <input type="email" required maxLength={190} {...field("email")} />
          </label>
          <label className="return-request-field">
            <span>Telefon *</span>
            <input required maxLength={30} {...field("phone")} />
          </label>
          <label className="return-request-field">
            <span>Sipariş Numarası *</span>
            <input required maxLength={60} {...field("orderNumber")} />
          </label>
          <label className="return-request-field full">
            <span>İade Edilen Ürün(ler) *</span>
            <textarea
              required
              rows={3}
              maxLength={600}
              {...field("productDescription")}
            />
          </label>
          <label className="return-request-field">
            <span>Kargo Takip Numarası</span>
            <input maxLength={60} {...field("trackingNumber")} />
          </label>
          <label className="return-request-field">
            <span>IBAN <small>(havale/EFT ödemesi yapanlar için)</small></span>
            <input
              maxLength={34}
              placeholder="TR.. .... .... .... .... .... .."
              {...field("iban")}
            />
          </label>
          <label className="return-request-field full">
            <span>İade Nedeni</span>
            <textarea rows={3} maxLength={600} {...field("reason")} />
          </label>
        </div>
        <button
          type="submit"
          className="button button-dark wide"
          disabled={submitting}
        >
          {submitting ? "Gönderiliyor…" : "İade Talebini Gönder"}
        </button>
      </form>
    </div>
  );
}
