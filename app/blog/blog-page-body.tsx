"use client";

import Link from "next/link";
import { useLanguage } from "../../lib/language-client";

type BlogPost = {
  id: number | string;
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  coverImage?: string;
  publishedAt?: string | null;
};

const copy = {
  tr: {
    heroLabel: "Terragolds Blog",
    heroTitle: "Takı bakımı, taş rehberleri ve stil önerileri",
    heroSubtitle:
      "Parçalarınızın ömrünü uzatacak bakım ipuçları ve doğru taşı seçmenize yardımcı olacak rehberler.",
    emptyText: "Yakında burada yeni içerikler yayınlanacak.",
    exploreCollection: "Koleksiyonu incele",
    dateLocale: "tr-TR",
  },
  en: {
    heroLabel: "Terragolds Blog",
    heroTitle: "Jewelry care, gemstone guides and style tips",
    heroSubtitle:
      "Care tips to extend the life of your pieces and guides to help you choose the right stone.",
    emptyText: "New content will be published here soon.",
    exploreCollection: "Explore the collection",
    dateLocale: "en-US",
  },
} as const;

export default function BlogPageBody({ posts }: { posts: BlogPost[] }) {
  const [language] = useLanguage();
  const t = copy[language];
  const dateFormatter = new Intl.DateTimeFormat(t.dateLocale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <section className="blog-hero">
        <p>{t.heroLabel}</p>
        <h1>{t.heroTitle}</h1>
        <span>{t.heroSubtitle}</span>
      </section>

      {posts.length ? (
        <section className="blog-grid">
          {posts.map((post) => (
            <Link className="blog-card" key={post.id} href={`/blog/${post.slug}`}>
              <div className="blog-card-image">
                <img
                  src={post.coverImage || "/stone-collection.jpg"}
                  alt={post.title}
                  loading="lazy"
                />
              </div>
              <div className="blog-card-body">
                {post.category && <span>{post.category}</span>}
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                {post.publishedAt && (
                  <small>{dateFormatter.format(new Date(post.publishedAt))}</small>
                )}
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="blog-empty">
          <p>{t.emptyText}</p>
          <Link href="/#shop">{t.exploreCollection}</Link>
        </div>
      )}
    </>
  );
}
