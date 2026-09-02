import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import { readPublishedSiteContent } from "../../lib/site-content";
import { defaultSiteContent } from "../../lib/site-content-types";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreTrustBar from "../store-trust-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readPublishedSiteContent().catch(
    () => defaultSiteContent,
  );
  return {
    title: content.seoSupportTitle,
    description: content.seoSupportDescription,
  };
}

export default async function SupportPage() {
  const [settings, content] = await Promise.all([
    readSettings(),
    readPublishedSiteContent().catch(() => defaultSiteContent),
  ]);
  const whatsappHref = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`
    : "";

  return (
    <main className="support-page">
      <StoreSubpageHeader />
      <StoreTrustBar />

      <section className="support-hero">
        <p>{content.supportEyebrow}</p>
        <h1>{content.supportTitle}</h1>
        <span>{content.supportDescription}</span>
      </section>

      <section className="support-contact-grid">
        <article>
          <span aria-hidden="true">@</span>
          <small>E-posta</small>
          <strong>{settings.email || "Yakında"}</strong>
          {settings.email && <a href={`mailto:${settings.email}`}>Mesaj gönder</a>}
        </article>
        <article>
          <span aria-hidden="true">☎</span>
          <small>Telefon</small>
          <strong>{settings.phone || "Yakında"}</strong>
          {settings.phone && <a href={`tel:${settings.phone}`}>Hemen ara</a>}
        </article>
        <article>
          <span aria-hidden="true">◌</span>
          <small>WhatsApp</small>
          <strong>{settings.whatsapp || "Yakında"}</strong>
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              Sohbet başlat
            </a>
          )}
        </article>
        <article>
          <span aria-hidden="true">◷</span>
          <small>Çalışma saatleri</small>
          <strong>{settings.businessHours || "Yakında"}</strong>
        </article>
      </section>

      <section className="support-topics">
        <article id="shipping">
          <small>01</small>
          <h2>{content.supportShippingTitle}</h2>
          <p>{content.supportShippingBody}</p>
          <Link href="/orders">Siparişlerimi görüntüle →</Link>
        </article>
        <article id="returns">
          <small>02</small>
          <h2>{content.supportReturnsTitle}</h2>
          <p>{content.supportReturnsBody}</p>
          {settings.email && <a href={`mailto:${settings.email}`}>Talep oluştur →</a>}
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
            <p>İletişim adresi</p>
            <h2>{settings.businessName || "Terragolds"}</h2>
            <span>
              {[settings.address, settings.district, settings.city]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
          {settings.mapUrl && (
            <a href={settings.mapUrl} target="_blank" rel="noreferrer">
              Haritada görüntüle →
            </a>
          )}
        </section>
      )}
      <StoreSiteFooter
        description={content.footerDescription}
        footerNote={settings.footerNote}
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
        phone={settings.phone}
        whatsapp={settings.whatsapp}
        email={settings.email}
        instagram={settings.instagram}
        facebook={settings.facebook}
        tiktok={settings.tiktok}
      />
      <FloatingSocialLinks />
    </main>
  );
}
