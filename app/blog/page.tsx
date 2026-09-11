import type { Metadata } from "next";
import Link from "next/link";
import { readPublishedBlogPosts } from "../../lib/blog";
import { readSettings } from "../../lib/store-db";
import { FloatingSocialLinks } from "../store-shared-chrome";
import StoreSiteFooter from "../store-site-footer";
import StoreSubpageHeader from "../store-subpage-header";
import {
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Terragolds",
  description:
    "Takı bakımı, taş rehberleri ve stil önerileri - Terragolds blogunda.",
  alternates: { canonical: `${SITE_URL}/blog` },
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function BlogIndexPage() {
  const [posts, settings] = await Promise.all([
    readPublishedBlogPosts(),
    readSettings(),
  ]);
  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Blog", url: `${SITE_URL}/blog` },
  ]);

  return (
    <main className="blog-page market-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <section className="blog-hero">
        <p>Terragolds Blog</p>
        <h1>Takı bakımı, taş rehberleri ve stil önerileri</h1>
        <span>
          Parçalarınızın ömrünü uzatacak bakım ipuçları ve doğru taşı seçmenize
          yardımcı olacak rehberler.
        </span>
      </section>

      {posts.length ? (
        <section className="blog-grid">
          {posts.map((post) => (
            <Link
              className="blog-card"
              key={post.id}
              href={`/blog/${post.slug}`}
            >
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
          <p>Yakında burada yeni içerikler yayınlanacak.</p>
          <Link href="/#shop">Koleksiyonu incele</Link>
        </div>
      )}

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
