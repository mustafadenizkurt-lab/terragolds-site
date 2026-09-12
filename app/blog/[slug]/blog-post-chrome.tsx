"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/language-client";

const copy = {
  tr: {
    backToBlog: "← Blog'a dön",
    ctaText: "Koleksiyonumuzdaki özenle seçilmiş takıları keşfedin.",
    exploreCollection: "Koleksiyonu incele",
  },
  en: {
    backToBlog: "← Back to Blog",
    ctaText: "Discover the carefully curated jewelry in our collection.",
    exploreCollection: "Explore the collection",
  },
} as const;

export function BlogPostBackLink() {
  const [language] = useLanguage();
  return <Link href="/blog">{copy[language].backToBlog}</Link>;
}

export function BlogPostCta() {
  const [language] = useLanguage();
  const t = copy[language];
  return (
    <footer className="blog-post-cta">
      <p>{t.ctaText}</p>
      <Link href="/#shop">{t.exploreCollection}</Link>
    </footer>
  );
}
