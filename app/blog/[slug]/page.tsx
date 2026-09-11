import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { readPublishedBlogPostBySlug } from "../../../lib/blog";
import { readSettings } from "../../../lib/store-db";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreSiteFooter from "../../store-site-footer";
import StoreSubpageHeader from "../../store-subpage-header";
import {
  articleSchema,
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const getPost = cache((slug: string) => readPublishedBlogPostBySlug(slug));

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "Yazı Bulunamadı", robots: { index: false, follow: false } };
  }
  const title = post.metaTitle || `${post.title} | Terragolds Blog`;
  const description =
    post.metaDescription || post.excerpt || post.content.slice(0, 155);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.coverImage
    ? new URL(post.coverImage, SITE_URL).toString()
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: image ? [{ url: image, alt: post.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPost(slug), readSettings()]);
  if (!post) notFound();

  const article = articleSchema({
    title: post.title,
    description: post.metaDescription || post.excerpt,
    image: post.coverImage || undefined,
    slug: post.slug,
    publishedAt: post.publishedAt ?? post.createdAt,
    updatedAt: post.updatedAt,
  });
  const breadcrumb = breadcrumbSchema([
    { name: "Ana Sayfa", url: `${SITE_URL}/` },
    { name: "Blog", url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ]);
  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <main className="blog-page blog-post-page market-subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(article) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
      />
      <StoreSubpageHeader />
      <article className="blog-post">
        <header className="blog-post-header">
          <Link href="/blog">← Blog&rsquo;a dön</Link>
          {post.category && <span>{post.category}</span>}
          <h1>{post.title}</h1>
          {post.publishedAt && (
            <small>{dateFormatter.format(new Date(post.publishedAt))}</small>
          )}
        </header>
        {post.coverImage && (
          <div className="blog-post-cover">
            <img src={post.coverImage} alt={post.title} />
          </div>
        )}
        <div className="blog-post-body">
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <p>{post.excerpt}</p>
          )}
        </div>
        <footer className="blog-post-cta">
          <p>Koleksiyonumuzdaki özenle seçilmiş takıları keşfedin.</p>
          <Link href="/#shop">Koleksiyonu incele</Link>
        </footer>
      </article>

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
