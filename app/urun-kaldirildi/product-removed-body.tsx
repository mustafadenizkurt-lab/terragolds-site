"use client";

import Link from "next/link";
import { useLanguage } from "../../lib/language-client";

const copy = {
  tr: {
    title: "Bu ürün artık mevcut değil",
    detail:
      "Ürün kataloğumuzdan kaldırılmış. Aşağıdaki bağlantılarla benzer ürünlere ulaşabilirsiniz.",
    backHome: "Ana Sayfaya Dön",
    allProducts: "Tüm Ürünler",
    faq: "Sıkça Sorulan Sorular",
    support: "Destek",
  },
  en: {
    title: "This product is no longer available",
    detail:
      "It has been removed from our catalog. You can find similar products with the links below.",
    backHome: "Back to Home",
    allProducts: "All Products",
    faq: "FAQ",
    support: "Support",
  },
} as const;

export default function ProductRemovedBody() {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <>
      <section className="category-hero section-shell">
        <p className="eyebrow">410</p>
        <h1>{t.title}</h1>
        <p>{t.detail}</p>
      </section>
      <section className="category-products section-shell not-found-actions">
        <Link className="button button-dark" href="/">
          {t.backHome}
        </Link>
        <Link className="button button-light" href="/#shop">
          {t.allProducts}
        </Link>
        <Link className="button button-light" href="/sss">
          {t.faq}
        </Link>
        <Link className="button button-light" href="/support">
          {t.support}
        </Link>
      </section>
    </>
  );
}
