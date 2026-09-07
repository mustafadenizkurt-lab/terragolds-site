import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import AISummaryBlock from "../ai-summary-block";
import {
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Hakkımızda | Terragolds",
  description: "Terragolds takı koleksiyonu, seçim ve paketleme yaklaşımı.",
  alternates: { canonical: "https://www.terragolds.com/hakkimizda" },
};

export default async function AboutPage() {
  const settings = await readSettings();
  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Hakkımızda", url: `${SITE_URL}/hakkimizda` },
  ]);

  return (
    <main className="about-page market-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <section className="about-hero">
        <div>
          <p>Terragolds</p>
          <h1>Zarafetin ve şıklığın benzersiz parçalarını özenle seçiyoruz.</h1>
          <span>
            Kaliteli işçilik ve modern tasarımı, güvenli paketleme ve
            şeffaf alışveriş deneyimiyle buluşturuyoruz.
          </span>
          <AISummaryBlock>
            Terragolds, kolye, küpe, bileklik ve yüzük gibi takı ürünleri
            satan Türkiye merkezli bir online mağazadır. Sıkça sorulan
            sorular ve kargo/iade koşulları için{" "}
            <Link href="/sss">SSS sayfasını</Link> inceleyebilirsiniz.
          </AISummaryBlock>
          <Link href="/#shop">Koleksiyonu incele</Link>
        </div>
        <img src="/terragolds-gold-showcase.webp" alt="Terragolds takı koleksiyonu" />
      </section>
      <section className="about-values">
        <article><span>01</span><h2>Özenli seçim</h2><p>Her parçayı form, yüzey, renk dengesi ve sergileme karakteri açısından inceliyoruz.</p></article>
        <article><span>02</span><h2>Şeffaf sunum</h2><p>Ürünlerimizin malzeme ve tasarım özelliklerini ürün bilgilerinde açıkça belirtiyoruz.</p></article>
        <article><span>03</span><h2>Güvenli teslimat</h2><p>Hassas yüzeylere uygun koruyucu katmanlar ve darbe emici paketleme kullanıyoruz.</p></article>
      </section>
      <section className="about-company">
        <p>İşletme bilgileri</p>
        <h2>{settings.businessName || "Terragolds"}</h2>
        <div>
          <span>{settings.email || "E-posta yönetim panelinden eklenmelidir."}</span>
          <span>{settings.phone || settings.whatsapp || "Telefon yönetim panelinden eklenmelidir."}</span>
          <span>{[settings.address, settings.district, settings.city].filter(Boolean).join(", ") || "Adres yönetim panelinden eklenmelidir."}</span>
        </div>
      </section>
      <StoreSiteFooter
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
