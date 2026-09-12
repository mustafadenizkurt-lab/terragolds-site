"use client";

import Link from "next/link";
import { useLanguage } from "../../lib/language-client";

type GalleryItem = {
  id: number | string;
  imageUrl: string;
  title?: string;
  description?: string;
};

const copy = {
  tr: {
    home: "Ana Sayfa",
    pageTitle: "Özel Üretim",
    eyebrow: "Kişiye özel",
    heroText:
      "Hayalinizdeki tasarımı bizimle paylaşın, sizin için özel üretelim. Taş, model ve ölçü tercihlerinizi birlikte belirleyelim; size özgü, tek parça bir eser hazırlayalım.",
    pastWorkLabel: "Geçmiş işlerimiz",
    galleryTitle: "Örnek Çalışmalarımız",
    galleryImageAltFallback: "Özel üretim çalışması",
  },
  en: {
    home: "Home",
    pageTitle: "Custom Orders",
    eyebrow: "Made for you",
    heroText:
      "Share the design you have in mind and we'll create it just for you. Let's decide on your stone, model and size preferences together and prepare a one-of-a-kind piece.",
    pastWorkLabel: "Our past work",
    galleryTitle: "Featured Custom Pieces",
    galleryImageAltFallback: "Custom order piece",
  },
} as const;

export default function CustomOrderPageBody({ galleryItems }: { galleryItems: GalleryItem[] }) {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <>
      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">{t.home}</Link>
          <span>/</span>
          <b>{t.pageTitle}</b>
        </div>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.pageTitle}</h1>
        <p>{t.heroText}</p>
      </section>

      {galleryItems.length > 0 && (
        <section className="custom-order-gallery-section section-shell">
          <div className="market-section-title">
            <span aria-hidden="true">✦</span>
            <div>
              <small>{t.pastWorkLabel}</small>
              <h2>{t.galleryTitle}</h2>
            </div>
          </div>
          <div className="custom-order-gallery-grid">
            {galleryItems.map((item) => (
              <figure className="custom-order-gallery-card" key={item.id}>
                <img src={item.imageUrl} alt={item.title || t.galleryImageAltFallback} loading="lazy" />
                {(item.title || item.description) && (
                  <figcaption>
                    {item.title && <strong>{item.title}</strong>}
                    {item.description && <span>{item.description}</span>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
