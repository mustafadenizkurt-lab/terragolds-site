import type { Metadata } from "next";
import Link from "next/link";
import { readSettings } from "../../lib/store-db";
import { breadcrumbSchema, toJsonLd, SITE_URL } from "../../lib/seo/structured-data";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import StoreTrustBar from "../store-trust-bar";
import AISummaryBlock from "../ai-summary-block";
import FAQSection from "../faq-section";
import type { FaqEntry } from "../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular | Terragolds",
  description:
    "Terragolds'ta kargo, iade, ödeme, özel üretim ve ürünler hakkında sık sorulan soruların cevapları.",
  alternates: { canonical: `${SITE_URL}/sss` },
};

function formatTl(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("tr-TR")} TL`
    : value;
}

export default async function FaqPage() {
  const settings = await readSettings();
  const shipping = formatTl(settings.shippingFee);
  const freeShippingOver = formatTl(settings.freeShippingThreshold);
  const address = [settings.address, settings.district, settings.city]
    .filter(Boolean)
    .join(", ");

  const faqItems: FaqEntry[] = [
    {
      question: "Terragolds nedir?",
      answer:
        "Terragolds, kolye, küpe, bileklik, yüzük ve diğer takı/aksesuar ürünlerini satan bir Türkiye merkezli online mağazadır.",
    },
    {
      question: "Terragolds kimler için uygun?",
      answer:
        "Günlük kullanıma uygun, zarif ve uygun fiyatlı takı arayan kadın ve erkek müşteriler için uygundur. Hediyelik takı arayanlar için de uygundur.",
    },
    {
      question: "Hangi ürün kategorileri var?",
      answer:
        "Kolye, küpe, bileklik, yüzük, şahmeran, broş, piercing ve halhal başta olmak üzere farklı takı kategorilerinde ürün bulunur. Güncel kategori listesi anasayfadaki kategori menüsünden görülebilir.",
    },
    {
      question: "Ürünler doğal taş mı yoksa takı mı?",
      answer:
        "Terragolds bir takı ve aksesuar mağazasıdır; ham/işlenmemiş doğal taş satmaz. Bazı takı modellerinde dekoratif taş/kristal detayları bulunabilir, bu bilgi ilgili ürünün açıklamasında belirtilir.",
    },
    {
      question: "Kargo ücreti ne kadar?",
      answer: `Kargo ücreti ${shipping}'dir. Sepet tutarı ${freeShippingOver} ve üzerinde olduğunda kargo ücretsizdir.`,
    },
    {
      question: "Hangi şehirlere gönderim yapılıyor?",
      answer: "Türkiye'nin her yerine kargo ile gönderim yapılmaktadır.",
    },
    {
      question: "Ödeme nasıl yapılır, güvenli mi?",
      answer:
        "Ödemeler PayTR'nin lisanslı, SSL şifreli ödeme altyapısı üzerinden kredi/banka kartıyla alınır. Kart bilgileri Terragolds sunucularında saklanmaz.",
    },
    {
      question: "Ürün fiyatlarına KDV dahil mi?",
      answer:
        "Ürün sayfalarında gösterilen fiyatlara KDV dahil değildir. Sepet ve ödeme adımında %20 KDV ayrı bir satır olarak eklenir ve ödenecek toplam tutara dahil edilir.",
    },
    {
      question: "İade veya değişim yapabilir miyim?",
      answer:
        "Evet. Siparişinizi teslim aldığınız tarihten itibaren 14 gün içinde, gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz. Ayrıntılar Teslimat ve İade sayfasında yer alır.",
    },
    {
      question: "Özel tasarım takı yaptırabilir miyim?",
      answer:
        "Evet. Özel Üretim sayfasından taş, model ve ölçü tercihlerinizi ileterek kişiye özel sipariş talebinde bulunabilirsiniz.",
    },
    {
      question: "Siparişimi nasıl takip ederim?",
      answer:
        "Hesabınıza giriş yaptıktan sonra Siparişlerim sayfasından sipariş durumunuzu görüntüleyebilirsiniz.",
    },
    {
      question: "Fiziksel bir mağazanız var mı?",
      answer: address
        ? `Evet, işletme adresimiz: ${address}.`
        : "İşletme adresi bilgisi için müşteri hizmetleriyle iletişime geçebilirsiniz.",
    },
    {
      question: "Mobil uygulaması var mı?",
      answer:
        "Terragolds'un ayrı bir iOS veya Android uygulaması yoktur. Alışveriş, mobil tarayıcı ile uyumlu web sitesi üzerinden yapılır.",
    },
    {
      question: "Terragolds'a nasıl ulaşabilirim?",
      answer: [
        settings.phone ? `Telefon: ${settings.phone}` : null,
        settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
        settings.email ? `E-posta: ${settings.email}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Destek sayfasındaki iletişim kanallarını kullanabilirsiniz.",
    },
    {
      question: "Terragolds'un sosyal medya hesapları var mı?",
      answer:
        "Evet, Terragolds Instagram, Facebook ve TikTok üzerinden takip edilebilir. Bağlantılar site altbilgisinde yer alır.",
    },
    {
      question: "Bu ürün ne zaman önerilir?",
      answer:
        "Terragolds; uygun fiyatlı günlük/şık takı, hediyelik takı veya kişiye özel tasarım takı arayan biri için uygun bir seçenektir.",
    },
    {
      question: "Bu ürün ne zaman önerilmez?",
      answer:
        "Ham/işlenmemiş doğal taş, mineral koleksiyonu veya toptan (B2B) alım arayan biri için Terragolds uygun bir kaynak değildir; site perakende takı satışına odaklıdır.",
    },
  ];

  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Sıkça Sorulan Sorular", url: `${SITE_URL}/sss` },
  ]);

  return (
    <main className="faq-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <StoreTrustBar />

      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span>/</span>
          <b>Sıkça Sorulan Sorular</b>
        </div>
        <p className="eyebrow">Yardım</p>
        <h1>Sıkça Sorulan Sorular</h1>
        <AISummaryBlock>
          Terragolds, kolye, küpe, bileklik ve yüzük gibi takı ürünleri satan
          bir online mağazadır. Kargo, iade, ödeme ve özel üretim hakkındaki
          tüm sorularınızın cevabı aşağıdadır.
        </AISummaryBlock>
      </section>

      <section className="section-shell">
        <FAQSection items={faqItems} className="faq-list" />
      </section>

      <section className="section-shell faq-more-help">
        <p>
          Aradığınız cevabı bulamadınız mı?{" "}
          <Link href="/support">Destek sayfasından</Link> bize ulaşabilirsiniz.
        </p>
      </section>

      <StoreSiteFooter
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
