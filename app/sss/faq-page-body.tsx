"use client";

import Link from "next/link";
import AISummaryBlock from "../ai-summary-block";
import FAQSection from "../faq-section";
import type { FaqEntry } from "../../lib/seo/structured-data";
import { useLanguage } from "../../lib/language-client";
import type { Language } from "../../lib/i18n";

function formatTl(value: string, locale: string, suffix: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString(locale)} ${suffix}` : value;
}

type Settings = {
  shippingFee: string;
  freeShippingThreshold: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
};

function buildFaqItems(language: Language, settings: Settings, address: string): FaqEntry[] {
  if (language === "en") {
    const shipping = formatTl(settings.shippingFee, "en-US", "TL");
    const freeShippingOver = formatTl(settings.freeShippingThreshold, "en-US", "TL");
    const contact = [
      settings.phone ? `Phone: ${settings.phone}` : null,
      settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
      settings.email ? `Email: ${settings.email}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "You can use the contact channels on the Support page.";

    return [
      {
        question: "What is Terragolds?",
        answer:
          "Terragolds is a Turkey-based online store with a catalog of over 4,000 products, selling necklaces, earrings, bracelets, rings and other jewelry/accessories.",
      },
      {
        question: "Who is Terragolds for?",
        answer:
          "It's suitable for women and men looking for elegant, affordable jewelry for everyday wear, as well as anyone shopping for jewelry as a gift.",
      },
      {
        question: "What product categories are available?",
        answer:
          "Earrings, women's bracelets, necklaces and women's rings are the most popular categories, alongside piercings, charm bracelets, sahmeran jewelry, men's bracelets, brooches, antique~vintage pieces, couple watches and hair accessories - over 4,000 products in total. The current category list is available from the category menu on the homepage.",
      },
      {
        question: "Are the products natural gemstones or jewelry?",
        answer:
          "Terragolds is a jewelry and accessories store; it does not sell raw/unprocessed natural stones. Some jewelry designs may include decorative stone/crystal details, which are noted in the relevant product's description.",
      },
      {
        question: "How much is shipping?",
        answer: `Shipping costs ${shipping}. Shipping is free when your cart total is ${freeShippingOver} or more.`,
      },
      {
        question: "Which cities do you ship to?",
        answer: "We ship by courier across all of Türkiye.",
      },
      {
        question: "How do I pay, and is it secure?",
        answer:
          "Payments are processed via PayTR's licensed, SSL-encrypted payment infrastructure using credit/debit cards. Card details are never stored on Terragolds servers.",
      },
      {
        question: "Do product prices include VAT?",
        answer:
          "Prices shown on product pages do not include VAT. A 20% VAT is added as a separate line at cart and checkout, and included in the total amount due.",
      },
      {
        question: "Can I return or exchange a product?",
        answer:
          "Yes. You can exercise your right of withdrawal within 14 days of receiving your order, without giving any reason. Details are on the Shipping & Returns page.",
      },
      {
        question: "Can I order custom-made jewelry?",
        answer:
          "Yes. You can request a personalized order via the Custom Orders page by sharing your stone, model and size preferences.",
      },
      {
        question: "How do I track my order?",
        answer: "Once signed in, you can view your order status from the My Orders page.",
      },
      {
        question: "Do you have a physical store?",
        answer: address
          ? `Yes, our business address is: ${address}.`
          : "You can contact customer service for our business address.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "Terragolds doesn't have a separate iOS or Android app. Shopping is done through the mobile-friendly website.",
      },
      {
        question: "How can I reach Terragolds?",
        answer: contact,
      },
      {
        question: "Does Terragolds have social media accounts?",
        answer:
          "Yes, you can follow Terragolds on Instagram, Facebook and TikTok. Links are in the site footer.",
      },
      {
        question: "When is this store a good fit?",
        answer:
          "Terragolds is a good option for anyone looking for affordable everyday/elegant jewelry, gift jewelry, or a custom-designed piece.",
      },
      {
        question: "When is this store not a good fit?",
        answer:
          "Terragolds isn't a good source for raw/unprocessed natural stones, mineral collecting, or wholesale (B2B) purchases - the site focuses on retail jewelry sales.",
      },
    ];
  }

  const shipping = formatTl(settings.shippingFee, "tr-TR", "TL");
  const freeShippingOver = formatTl(settings.freeShippingThreshold, "tr-TR", "TL");
  const contact = [
    settings.phone ? `Telefon: ${settings.phone}` : null,
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
    settings.email ? `E-posta: ${settings.email}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Destek sayfasındaki iletişim kanallarını kullanabilirsiniz.";

  return [
    {
      question: "Terragolds nedir?",
      answer:
        "Terragolds, 4.000'den fazla ürünlük kataloğuyla kolye, küpe, bileklik, yüzük ve diğer takı/aksesuar ürünlerini satan bir Türkiye merkezli online mağazadır.",
    },
    {
      question: "Terragolds kimler için uygun?",
      answer:
        "Günlük kullanıma uygun, zarif ve uygun fiyatlı takı arayan kadın ve erkek müşteriler için uygundur. Hediyelik takı arayanlar için de uygundur.",
    },
    {
      question: "Hangi ürün kategorileri var?",
      answer:
        "En çok ürün küpe, bayan bileklik, kolye ve bayan yüzük kategorilerinde olmak üzere; piercing, charm bileklik, şahmeran, erkek bileklik, broş, antika~vintage, sevgili saatleri ve saç aksesuarı gibi birçok kategoride toplam 4.000'den fazla ürün bulunur. Güncel kategori listesi anasayfadaki kategori menüsünden görülebilir.",
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
      answer: contact,
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
}

const copy = {
  tr: {
    home: "Ana Sayfa",
    pageTitle: "Sıkça Sorulan Sorular",
    help: "Yardım",
    inShort: "Kısaca",
    summary:
      "Terragolds, kolye, küpe, bileklik ve yüzük gibi takı ürünleri satan bir online mağazadır. Kargo, iade, ödeme ve özel üretim hakkındaki tüm sorularınızın cevabı aşağıdadır.",
    noAnswerBefore: "Aradığınız cevabı bulamadınız mı? ",
    noAnswerLink: "Destek sayfasından",
    noAnswerAfter: " bize ulaşabilirsiniz.",
  },
  en: {
    home: "Home",
    pageTitle: "Frequently Asked Questions",
    help: "Help",
    inShort: "In short",
    summary:
      "Terragolds is an online store selling jewelry such as necklaces, earrings, bracelets and rings. Below are the answers to all your questions about shipping, returns, payment and custom orders.",
    noAnswerBefore: "Couldn't find the answer you're looking for? ",
    noAnswerLink: "Reach us from the Support page",
    noAnswerAfter: ".",
  },
} as const;

export default function FaqPageBody({
  settings,
  address,
}: {
  settings: Settings;
  address: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const faqItems = buildFaqItems(language, settings, address);

  return (
    <>
      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">{t.home}</Link>
          <span>/</span>
          <b>{t.pageTitle}</b>
        </div>
        <p className="eyebrow">{t.help}</p>
        <h1>{t.pageTitle}</h1>
        <AISummaryBlock label={t.inShort}>{t.summary}</AISummaryBlock>
      </section>

      <section className="section-shell">
        <FAQSection items={faqItems} className="faq-list" />
      </section>

      <section className="section-shell faq-more-help">
        <p>
          {t.noAnswerBefore}
          <Link href="/support">{t.noAnswerLink}</Link>
          {t.noAnswerAfter}
        </p>
      </section>
    </>
  );
}
