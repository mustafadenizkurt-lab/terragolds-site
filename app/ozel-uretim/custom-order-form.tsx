"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLanguage } from "../../lib/language-client";

function whatsappDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (!digits) digits = "905322408229";
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

const copy = {
  tr: {
    name: "İsim",
    namePlaceholder: "Adınız Soyadınız",
    phoneNumber: "Telefon Numarası",
    phonePlaceholder: "05xx xxx xx xx",
    note: "Notunuz (isteğe bağlı)",
    notePlaceholder:
      "Tasarım fikrinizi, taş tercihinizi veya ölçü bilgilerinizi kısaca paylaşabilirsiniz.",
    continueOnWhatsapp: "WhatsApp'tan Devam Et",
    waMessage: (name: string, phone: string, note: string) => {
      let message = `Merhaba, özel üretim talebim var. İsim: ${name}, Telefon: ${phone}.`;
      if (note) message += ` Talebim: ${note}`;
      return message;
    },
  },
  en: {
    name: "Name",
    namePlaceholder: "Your full name",
    phoneNumber: "Phone Number",
    phonePlaceholder: "+90 5xx xxx xx xx",
    note: "Your note (optional)",
    notePlaceholder:
      "Briefly share your design idea, stone preference or size details.",
    continueOnWhatsapp: "Continue on WhatsApp",
    waMessage: (name: string, phone: string, note: string) => {
      let message = `Hello, I have a custom order request. Name: ${name}, Phone: ${phone}.`;
      if (note) message += ` My request: ${note}`;
      return message;
    },
  },
} as const;

export default function CustomOrderForm({
  whatsapp,
  phone,
}: {
  whatsapp?: string;
  phone?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const [name, setName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedNote = note.trim();
    const message = t.waMessage(trimmedName, trimmedPhone, trimmedNote);
    const digits = whatsappDigits(whatsapp || phone || "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="custom-order-section section-shell">
      <form className="custom-order-form" onSubmit={handleSubmit}>
        <label className="custom-order-field">
          <span>{t.name}</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.namePlaceholder}
          />
        </label>
        <label className="custom-order-field">
          <span>{t.phoneNumber}</span>
          <input
            required
            type="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder={t.phonePlaceholder}
          />
        </label>
        <label className="custom-order-field">
          <span>{t.note}</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t.notePlaceholder}
            rows={4}
          />
        </label>
        <button type="submit" className="custom-order-submit">
          <MessageCircle aria-hidden="true" size={18} strokeWidth={2} />
          {t.continueOnWhatsapp}
        </button>
      </form>
    </section>
  );
}
