import type { Metadata } from "next";
import { cache } from "react";
import { permanentRedirect } from "next/navigation";
import {
  getDiscountedPrice,
  productDescriptorPhrase,
} from "../../../lib/store-data";
import { readProductByIdOrSlug, readSettings } from "../../../lib/store-db";
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
    `${product.name}, ${productDescriptorPhrase(product)}. ${product.description}`.slice(
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

  // Canonicalize legacy numeric URLs to the slug URL once a slug exists,
  // so old links/bookmarks/search results keep working via redirect.
  if (product?.slug && param !== product.slug) {
    permanentRedirect(`/products/${product.slug}`);
  }

  const productUrl = product
    ? `https://www.terragolds.com/products/${product.slug || product.id}`
    : "";
  const structuredData = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: [product.image, product.hoverImage]
          .filter(Boolean)
          .map((image) =>
            new URL(image as string, "https://www.terragolds.com").toString(),
          ),
        sku: `TG-${product.id}`,
        category: product.category,
        brand: { "@type": "Brand", name: "Terragolds" },
        offers: {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: "TRY",
          price: getDiscountedPrice(product).toFixed(2),
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
        ...(product.reviewCount && product.reviewAverage
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.reviewAverage,
                reviewCount: product.reviewCount,
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c"),
          }}
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
