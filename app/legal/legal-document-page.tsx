import Link from "next/link";
import { readPublishedSiteContent } from "../../lib/site-content";
import {
  defaultSiteContent,
  readLegalDocument,
  type LegalDocumentKey,
} from "../../lib/site-content-types";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import ReturnRequestForm from "./return-request-form";

export type { LegalDocumentKey };

function paragraphsOf(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function bulletsOf(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function LegalDocumentPage({ document }: { document: LegalDocumentKey }) {
  const [settings, siteContent] = await Promise.all([
    readSettings(),
    readPublishedSiteContent().catch(() => defaultSiteContent),
  ]);
  const content = readLegalDocument(siteContent, document);
  const address = [settings.address, settings.district, settings.city]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="legal-page market-subpage">
      <StoreSubpageHeader />
      <section className="legal-hero">
        <div className="legal-breadcrumb"><Link href="/">Ana Sayfa</Link><span>/</span><b>{content.title}</b></div>
        <p>{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <span>{content.summary}</span>
        <small>Son güncelleme: {content.updated}</small>
      </section>
      <div className="legal-layout">
        <aside>
          <strong>Yasal Belgeler</strong>
          <Link href="/guvenli-alisveris">Güvenli Alışveriş</Link>
          <Link href="/kvkk">KVKK</Link>
          <Link href="/gizlilik-politikasi">Gizlilik</Link>
          <Link href="/cerez-politikasi">Çerezler</Link>
          <Link href="/mesafeli-satis-sozlesmesi">Mesafeli Satış</Link>
          <Link href="/on-bilgilendirme-formu">Ön Bilgilendirme</Link>
          <Link href="/teslimat-ve-iade">Teslimat ve İade</Link>
          <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
        </aside>
        <article className="legal-document">
          {content.sections.map((section, index) => (
            <section key={`${index}-${section.title}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                {section.type === "bullets" ? (
                  <ul>
                    {bulletsOf(section.text).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  paragraphsOf(section.text).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))
                )}
              </div>
            </section>
          ))}
          {document === "deliveryReturns" && <ReturnRequestForm />}
          <section className="legal-seller-card">
            <span>—</span>
            <div>
              <h2>Satıcı / veri sorumlusu iletişim bilgileri</h2>
              <dl>
                <div><dt>İşletme</dt><dd>{settings.businessName || "Terragolds"}</dd></div>
                <div><dt>Adres</dt><dd>{address || "Yönetim panelinden eklenmelidir."}</dd></div>
                <div><dt>Telefon</dt><dd>{settings.phone || settings.whatsapp || "Yönetim panelinden eklenmelidir."}</dd></div>
                <div><dt>E-posta</dt><dd>{settings.email || "Yönetim panelinden eklenmelidir."}</dd></div>
              </dl>
            </div>
          </section>
          <div className="legal-note">
            Bu metin genel bilgilendirme taslağıdır. Şirket unvanı, vergi/MERSİS bilgileri,
            iade taşıyıcısı ve fiili iş süreçleriyle eşleştirilerek yayından önce hukuk danışmanı
            tarafından kontrol edilmelidir.
          </div>
        </article>
      </div>
      <StoreSiteFooter
        description={siteContent.footerDescription}
        footerNote={settings.footerNote}
        businessName={settings.businessName}
        address={address}
      />
      <FloatingSocialLinks />
    </main>
  );
}
