"use client";

import { useEffect, useState } from "react";

const QUICK_MESSAGES = [
  "Kargo durumumu öğrenmek istiyorum",
  "İade/değişim yapmak istiyorum",
  "Bir ürün hakkında sorum var",
  "Siparişimle ilgili başka bir konu",
];

/**
 * A guided chat-launcher panel over the existing WhatsApp contact - not a
 * separate live-chat service (no account/backend needed), just a nicer
 * front door onto the same wa.me link: pick a topic, land in WhatsApp with
 * that message already typed in.
 */
export default function WhatsAppChatWidget({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const waNumber = phone.replace(/\D/g, "");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const waUrl = (message: string) =>
    `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

  return (
    <>
      {open && (
        <div className="whatsapp-chat-panel" role="dialog" aria-label="WhatsApp ile iletişim">
          <div className="whatsapp-chat-panel-head">
            <strong>Terragolds Destek</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">
              ×
            </button>
          </div>
          <p>
            Merhaba! Size nasıl yardımcı olabiliriz? Bir konu seçin, WhatsApp&apos;ta
            devam edelim.
          </p>
          <div className="whatsapp-chat-quick-replies">
            {QUICK_MESSAGES.map((message) => (
              <a key={message} href={waUrl(message)} target="_blank" rel="noreferrer">
                {message}
              </a>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="floating-social-link whatsapp whatsapp-chat-bubble"
        onClick={() => setOpen((current) => !current)}
        aria-label="Canlı destek"
        aria-expanded={open}
      >
        <img
          src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg"
          alt=""
          width={18}
          height={18}
        />
      </button>
    </>
  );
}
