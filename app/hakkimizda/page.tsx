import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";

export const metadata: Metadata = {
  title: "Hakkımızda | Terragolds",
  description: "Terragolds doğal taş koleksiyonu, seçim ve paketleme yaklaşımı.",
  alternates: { canonical: "https://www.terragolds.com/hakkimizda" },
};

export default async function AboutPage() {
  const settings = await readSettings();
  return (
    <main className="about-page market-subpage">
      <StoreSubpageHeader />
      <section className="about-hero">
        <div>
          <p>Terragolds</p>
          <h1>Doğanın benzersiz parçalarını özenle seçiyoruz.</h1>
          <span>
            Rengi, dokusu ve doğal karakteri güçlü taşları güvenli paketleme ve
            şeffaf alışveriş deneyimiyle buluşturuyoruz.
          </span>
          <Link href="/#shop">Koleksiyonu incele</Link>
        </div>
        <img src="/terragolds-gold-showcase.webp" alt="Terragolds doğal taş koleksiyonu" />
      </section>
      <section className="about-values">
        <article><span>01</span><h2>Özenli seçim</h2><p>Her parçayı form, yüzey, renk dengesi ve sergileme karakteri açısından inceliyoruz.</p></article>
        <article><span>02</span><h2>Şeffaf sunum</h2><p>Doğal taşların benzersiz damar, ton ve form farklılıklarını ürün bilgilerinde açıkça belirtiyoruz.</p></article>
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
