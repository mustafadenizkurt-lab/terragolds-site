"use client";

import Link from "next/link";
import { useLanguage } from "../lib/language-client";

const copy = {
  tr: {
    title: "Aradığınız sayfa bulunamadı",
    detail:
      "Bağlantı eski olabilir veya ürün artık satışta olmayabilir. Aşağıdaki bağlantılarla devam edebilirsiniz.",
    backHome: "Ana Sayfaya Dön",
    allProducts: "Tüm Ürünler",
    faq: "Sıkça Sorulan Sorular",
    support: "Destek",
  },
  en: {
    title: "We couldn't find that page",
    detail:
      "The link may be outdated, or the product may no longer be available. You can continue with the links below.",
    backHome: "Back to Home",
    allProducts: "All Products",
    faq: "FAQ",
    support: "Support",
  },
} as const;

export default function NotFoundBody() {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <>
      <section className="category-hero section-shell">
        <p className="eyebrow">404</p>
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
