"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

function whatsappDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (!digits) digits = "905322408229";
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

export default function CustomOrderForm({
  whatsapp,
  phone,
}: {
  whatsapp?: string;
  phone?: string;
}) {
  const [name, setName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedNote = note.trim();
    let message = `Merhaba, özel üretim talebim var. İsim: ${trimmedName}, Telefon: ${trimmedPhone}.`;
    if (trimmedNote) message += ` Talebim: ${trimmedNote}`;
    const digits = whatsappDigits(whatsapp || phone || "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="custom-order-section section-shell">
      <form className="custom-order-form" onSubmit={handleSubmit}>
        <label className="custom-order-field">
          <span>İsim</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Adınız Soyadınız"
          />
        </label>
        <label className="custom-order-field">
          <span>Telefon Numarası</span>
          <input
            required
            type="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="05xx xxx xx xx"
          />
        </label>
        <label className="custom-order-field">
          <span>Notunuz (isteğe bağlı)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Tasarım fikrinizi, taş tercihinizi veya ölçü bilgilerinizi kısaca paylaşabilirsiniz."
            rows={4}
          />
        </label>
        <button type="submit" className="custom-order-submit">
          <MessageCircle aria-hidden="true" size={18} strokeWidth={2} />
          WhatsApp&apos;tan Devam Et
        </button>
      </form>
    </section>
  );
}
