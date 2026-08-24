import type { Metadata } from "next";
import { getDiscountedPrice } from "../../../lib/store-data";
import { readProducts, readSettings } from "../../../lib/store-db";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreSubpageHeader from "../../store-subpage-header";
import StoreSiteFooter from "../../store-site-footer";
import StoreTrustBar from "../../store-trust-bar";
import ProductDetailClient from "./product-detail-client";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = (await readProducts()).find(
    (item) => item.id === Number(id),
  );
  if (!product) {
    return {
      title: "Ürün Bulunamadı",
      robots: { index: false, follow: false },
    };
  }
  const description =
    `${product.name} ${product.stone} doğal taş ürünü. ${product.description}`.slice(
      0,
      155,
    );
  const url = `https://www.terragolds.com/products/${product.id}`;
  const images = [product.image, product.hoverImage]
    .filter(Boolean)
    .map((image) =>
      new URL(image as string, "https://www.terragolds.com").toString(),
    );
  return {
    title: `${product.name} – ${product.stone}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
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
      title: product.name,
      description,
      images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const [products, settings] = await Promise.all([
    readProducts(),
    readSettings(),
  ]);
  const product = products.find((item) => item.id === Number(id));
  const productUrl = product
    ? `https://www.terragolds.com/products/${product.id}`
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
      <ProductDetailClient productId={Number(id)} showHeader={false} />
      <StoreSiteFooter
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
      />
      <FloatingSocialLinks />
    </>
  );
}
