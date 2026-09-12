import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getDiscountedPrice,
  productDescriptorPhrase,
} from "../../../lib/store-data";
import { readProductByIdOrSlug, readSettings } from "../../../lib/store-db";
import { decodeHtmlEntities } from "../../../lib/text-utils";
import { categoryToSlug } from "../../../lib/category-slugs";
import {
  productSchema,
  breadcrumbSchema,
  toJsonLd,
  SITE_URL,
} from "../../../lib/seo/structured-data";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreSubpageHeader from "../../store-subpage-header";
import StoreSiteFooter from "../../store-site-footer";
import StoreTrustBar from "../../store-trust-bar";
import ProductDetailClient from "./product-detail-client";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

// Shared between generateMetadata and the page body so the (id-or-slug)
// product lookup only hits the database once per request instead of twice.
const getProduct = cache((param: string) => readProductByIdOrSlug(param));

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id: param } = await params;
  const product = await getProduct(param);
  if (!product) {
    return {
      title: "Ürün Bulunamadı",
      robots: { index: false, follow: false },
    };
  }
  const title =
    product.metaTitle || `${product.name} – ${product.stone || product.category}`;
  const description =
    product.metaDescription ||
    `${product.name}, ${productDescriptorPhrase(product)}. ${decodeHtmlEntities(product.description)}`.slice(
      0,
      155,
    );
  const url = `https://www.terragolds.com/products/${product.slug || product.id}`;
  const images = [product.image, product.hoverImage]
    .filter(Boolean)
    .map((image) =>
      new URL(image as string, "https://www.terragolds.com").toString(),
    );
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: images.map((image) => ({
        url: image,
        alt: product.name,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id: param } = await params;
  const [product, settings] = await Promise.all([
    getProduct(param),
    readSettings(),
  ]);

  // A nonexistent product must respond 404, not 200 with a client-rendered
  // "not found" message - search engines were indexing dead product URLs
  // as if they were real pages (see app/blog/[slug]/page.tsx for the same
  // pattern). ProductDetailClient's own not-found state below still
  // handles the case of a product deleted after this page was cached.
  if (!product) notFound();

  // Canonicalize legacy numeric URLs to the slug URL once a slug exists,
  // so old links/bookmarks/search results keep working via redirect.
  if (product?.slug && param !== product.slug) {
    permanentRedirect(`/products/${product.slug}`);
  }

  const structuredData = product
    ? productSchema({
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        hoverImage: product.hoverImage,
        category: product.category,
        slug: product.slug,
        price: getDiscountedPrice(product),
        stock: product.stock,
        reviewAverage: product.reviewAverage,
        reviewCount: product.reviewCount,
      })
    : null;
  const breadcrumb = product
    ? breadcrumbSchema([
        { name: "Ana Sayfa", url: `${SITE_URL}/` },
        {
          name: product.category,
          url: `${SITE_URL}/kategori/${categoryToSlug(product.category)}`,
        },
        {
          name: product.name,
          url: `${SITE_URL}/products/${product.slug || product.id}`,
        },
      ])
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
        />
      )}
      {breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumb) }}
        />
      )}
      <StoreSubpageHeader />
      <StoreTrustBar />
      <ProductDetailClient productId={product?.id ?? 0} showHeader={false} />
      <StoreSiteFooter
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
    </>
  );
}
