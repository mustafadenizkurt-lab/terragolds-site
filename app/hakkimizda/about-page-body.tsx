"use client";

import Link from "next/link";
import AISummaryBlock from "../ai-summary-block";
import { useLanguage } from "../../lib/language-client";

const copy = {
  tr: {
    heroTitle: "Zarafetin ve şıklığın benzersiz parçalarını özenle seçiyoruz.",
    heroSubtitle:
      "Kaliteli işçilik ve modern tasarımı, güvenli paketleme ve şeffaf alışveriş deneyimiyle buluşturuyoruz.",
    inShort: "Kısaca",
    summaryBefore:
      "Terragolds, kolye, küpe, bileklik ve yüzük gibi takı ürünleri satan Türkiye merkezli bir online mağazadır. Sıkça sorulan sorular ve kargo/iade koşulları için ",
    summaryLink: "SSS sayfasını",
    summaryAfter: " inceleyebilirsiniz.",
    exploreCollection: "Koleksiyonu incele",
    heroImageAlt: "Terragolds takı koleksiyonu",
    values: [
      {
        num: "01",
        title: "Özenli seçim",
        text: "Her parçayı form, yüzey, renk dengesi ve sergileme karakteri açısından inceliyoruz.",
      },
      {
        num: "02",
        title: "Şeffaf sunum",
        text: "Ürünlerimizin malzeme ve tasarım özelliklerini ürün bilgilerinde açıkça belirtiyoruz.",
      },
      {
        num: "03",
        title: "Güvenli teslimat",
        text: "Hassas yüzeylere uygun koruyucu katmanlar ve darbe emici paketleme kullanıyoruz.",
      },
    ],
    companyInfo: "İşletme bilgileri",
    emailFallback: "E-posta yönetim panelinden eklenmelidir.",
    phoneFallback: "Telefon yönetim panelinden eklenmelidir.",
    addressFallback: "Adres yönetim panelinden eklenmelidir.",
  },
  en: {
    heroTitle: "We carefully curate unique pieces of elegance and style.",
    heroSubtitle:
      "We bring together quality craftsmanship and modern design with secure packaging and a transparent shopping experience.",
    inShort: "In short",
    summaryBefore:
      "Terragolds is a Turkey-based online store selling jewelry such as necklaces, earrings, bracelets and rings. For frequently asked questions and shipping/return terms, check out our ",
    summaryLink: "FAQ page",
    summaryAfter: ".",
    exploreCollection: "Explore the collection",
    heroImageAlt: "Terragolds jewelry collection",
    values: [
      {
        num: "01",
        title: "Careful selection",
        text: "We inspect every piece for its form, surface, color balance and display character.",
      },
      {
        num: "02",
        title: "Transparent presentation",
        text: "We clearly state each product's material and design details in the product information.",
      },
      {
        num: "03",
        title: "Secure delivery",
        text: "We use protective layers and shock-absorbing packaging suited to delicate surfaces.",
      },
    ],
    companyInfo: "Business information",
    emailFallback: "Email must be added from the admin panel.",
    phoneFallback: "Phone must be added from the admin panel.",
    addressFallback: "Address must be added from the admin panel.",
  },
} as const;

export default function AboutPageBody({
  businessName,
  email,
  phone,
  whatsapp,
  address,
}: {
  businessName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <>
      <section className="about-hero">
        <div>
          <p>Terragolds</p>
          <h1>{t.heroTitle}</h1>
          <span>{t.heroSubtitle}</span>
          <AISummaryBlock label={t.inShort}>
            {t.summaryBefore}
            <Link href="/sss">{t.summaryLink}</Link>
            {t.summaryAfter}
          </AISummaryBlock>
          <Link href="/#shop">{t.exploreCollection}</Link>
        </div>
        <img src="/terragolds-gold-showcase.webp" alt={t.heroImageAlt} />
      </section>
      <section className="about-values">
        {t.values.map((value) => (
          <article key={value.num}>
            <span>{value.num}</span>
            <h2>{value.title}</h2>
            <p>{value.text}</p>
          </article>
        ))}
      </section>
      <section className="about-company">
        <p>{t.companyInfo}</p>
        <h2>{businessName || "Terragolds"}</h2>
        <div>
          <span>{email || t.emailFallback}</span>
          <span>{phone || whatsapp || t.phoneFallback}</span>
          <span>{address || t.addressFallback}</span>
        </div>
      </section>
    </>
  );
}
