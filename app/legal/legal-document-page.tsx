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
import { LegalHero, LegalSidebar, LegalSellerCard } from "./legal-document-chrome";

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
      <LegalHero content={content} />
      <div className="legal-layout">
        <LegalSidebar />
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
          <LegalSellerCard
            businessName={settings.businessName}
            address={address}
            phone={settings.phone || settings.whatsapp}
            email={settings.email}
          />
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
