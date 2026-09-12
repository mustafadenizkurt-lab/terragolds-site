"use client";

import Link from "next/link";
import { useLanguage } from "../../lib/language-client";

// content.support* fields below are admin-authored CMS copy (see
// lib/site-content-types.ts) with no stored English variant - like the
// legal documents, translating them would mean inventing business content
// on the site owner's behalf, so they're left in Turkish. Only this file's
// own static chrome (labels, CTAs) is translated.
const copy = {
  tr: {
    email: "E-posta",
    phone: "Telefon",
    whatsapp: "WhatsApp",
    businessHours: "Çalışma saatleri",
    comingSoon: "Yakında",
    sendMessage: "Mesaj gönder",
    callNow: "Hemen ara",
    startChat: "Sohbet başlat",
    viewOrders: "Siparişlerimi görüntüle →",
    createRequest: "Talep oluştur →",
    contactAddress: "İletişim adresi",
    viewOnMap: "Haritada görüntüle →",
  },
  en: {
    email: "Email",
    phone: "Phone",
    whatsapp: "WhatsApp",
    businessHours: "Business hours",
    comingSoon: "Coming soon",
    sendMessage: "Send a message",
    callNow: "Call now",
    startChat: "Start chat",
    viewOrders: "View my orders →",
    createRequest: "Create a request →",
    contactAddress: "Contact address",
    viewOnMap: "View on map →",
  },
} as const;

type Settings = {
  email?: string;
  phone?: string;
  whatsapp?: string;
  businessHours?: string;
  businessName?: string;
  address?: string;
  district?: string;
  city?: string;
  mapUrl?: string;
};

type Content = {
  supportEyebrow: string;
  supportTitle: string;
  supportDescription: string;
  supportShippingTitle: string;
  supportShippingBody: string;
  supportReturnsTitle: string;
  supportReturnsBody: string;
  supportCareTitle: string;
  supportCareBody: string;
};

export default function SupportPageBody({
  settings,
  content,
}: {
  settings: Settings;
  content: Content;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const whatsappHref = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : "";
  const address = [settings.address, settings.district, settings.city]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <section className="support-hero">
        <p>{content.supportEyebrow}</p>
        <h1>{content.supportTitle}</h1>
        <span>{content.supportDescription}</span>
      </section>

      <section className="support-contact-grid">
        <article>
          <span aria-hidden="true">@</span>
          <small>{t.email}</small>
          <strong>{settings.email || t.comingSoon}</strong>
          {settings.email && <a href={`mailto:${settings.email}`}>{t.sendMessage}</a>}
        </article>
        <article>
          <span aria-hidden="true">☎</span>
          <small>{t.phone}</small>
          <strong>{settings.phone || t.comingSoon}</strong>
          {settings.phone && <a href={`tel:${settings.phone}`}>{t.callNow}</a>}
        </article>
        <article>
          <span aria-hidden="true">◌</span>
          <small>{t.whatsapp}</small>
          <strong>{settings.whatsapp || t.comingSoon}</strong>
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              {t.startChat}
            </a>
          )}
        </article>
        <article>
          <span aria-hidden="true">◷</span>
          <small>{t.businessHours}</small>
          <strong>{settings.businessHours || t.comingSoon}</strong>
        </article>
      </section>

      <section className="support-topics">
        <article id="shipping">
          <small>01</small>
          <h2>{content.supportShippingTitle}</h2>
          <p>{content.supportShippingBody}</p>
          <Link href="/orders">{t.viewOrders}</Link>
        </article>
        <article id="returns">
          <small>02</small>
          <h2>{content.supportReturnsTitle}</h2>
          <p>{content.supportReturnsBody}</p>
          {settings.email && <a href={`mailto:${settings.email}`}>{t.createRequest}</a>}
        </article>
        <article id="care">
          <small>03</small>
          <h2>{content.supportCareTitle}</h2>
          <p>{content.supportCareBody}</p>
        </article>
      </section>

      {(settings.address || settings.city) && (
        <section className="support-location">
          <div>
            <p>{t.contactAddress}</p>
            <h2>{settings.businessName || "Terragolds"}</h2>
            <span>{address}</span>
          </div>
          {settings.mapUrl && (
            <a href={settings.mapUrl} target="_blank" rel="noreferrer">
              {t.viewOnMap}
            </a>
          )}
        </section>
      )}
    </>
  );
}
