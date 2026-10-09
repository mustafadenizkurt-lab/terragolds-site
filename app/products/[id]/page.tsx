import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getDiscountedPrice,
  productDescriptorPhrase,
} from "../../../lib/store-data";
import {
  findProductSlugByLegacySlug,
  getD1,
  readProductByIdOrSlug,
  readRelatedProducts,
  readSettings,
} from "../../../lib/store-db";
import {
  findActiveProductByStrippedSlug,
  findManualRedirect,
  guessCategoryFromSlug,
} from "../../../lib/product-redirects";
import { optimizedImageUrl } from "../../../lib/image-transform";
import { decodeHtmlEntities, truncateAtWord } from "../../../lib/text-utils";
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
  // The supplier code keeps titles unique - many supplier products share
  // the exact same name (e.g. 11x "14K Gold Renk Kaplama CM Kadın Küpe"),
  // and Google was folding them together as duplicates.
  const code = product.xmlExternalId ? ` #${product.xmlExternalId}` : "";
  const title =
    product.metaTitle ||
    `${product.name}${code} – ${product.stone || product.category}`;
  const description =
    product.metaDescription ||
    truncateAtWord(
      `${product.name}${code}, ${productDescriptorPhrase(product)}. ${decodeHtmlEntities(
        product.seoDescription || product.description,
      )}`,
      155,
    );
  const url = `https://www.terragolds.com/products/${product.slug || product.id}`;
  const images = [product.image, product.hoverImage, product.image3, product.image4]
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

  // Old bare slug of a product that later got a "-1234" suffix: send it to
  // the current URL instead of a 404 (GSC "Bulunamadı (404)").
  if (!product) {
    const currentSlug = await findProductSlugByLegacySlug(param).catch(() => null);
    if (currentSlug) permanentRedirect(`/products/${currentSlug}`);
  }

  // Ürün değişikliği (slug değişti / ürün silindi) admin panelinden
  // product_redirects tablosuna kaydediliyor (bkz. lib/product-redirects.ts) -
  // yukarıdaki sonek kontrolünden sonra, en spesifik eşleşme önce denensin
  // diye burada. Sırayla: 1) elle/otomatik kaydedilmiş yönlendirme,
  // 2) sondaki sayı ekini atıp çıplak slug'a sahip aktif ürün,
  // 3) anahtar kelimeden kategori tahmini. Hiçbiri yoksa normal 404'e düşer
  // (worker/index.ts bunu gerçek bir 410'a çevirir).
  if (!product) {
    const db = getD1();
    const manualTarget = await findManualRedirect(db, param).catch(() => null);
    if (manualTarget) permanentRedirect(manualTarget);

    const strippedMatch = await findActiveProductByStrippedSlug(db, param).catch(() => null);
    if (strippedMatch) permanentRedirect(`/products/${strippedMatch}`);

    const guessedCategory = guessCategoryFromSlug(param);
    if (guessedCategory) permanentRedirect(`/kategori/${categoryToSlug(guessedCategory)}`);
  }

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

  const relatedProducts = await readRelatedProducts(product.category, product.id).catch(
    () => [],
  );
  // Purchase cost never goes into the page payload.
  const initialProduct = { ...product, cost: 0 };

  const structuredData = product
    ? productSchema({
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        hoverImage: product.hoverImage,
        image3: product.image3,
        image4: product.image4,
        category: product.category,
        slug: product.slug,
        price: getDiscountedPrice(product),
        stock: product.stock,
        reviewAverage: product.reviewAverage,
        reviewCount: product.reviewCount,
        shippingFee: settings.shippingFee,
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
      <ProductDetailClient
        productId={product.id}
        showHeader={false}
        initialProduct={initialProduct}
      />
      {relatedProducts.length > 0 && (
        <section className="category-products section-shell related-products">
          <h2>Benzer ürünler</h2>
          <div className="category-grid">
            {relatedProducts.map((related) => (
              <article className="category-product-card" key={related.id}>
                <div className="category-product-image-wrap">
                  <a
                    className="category-product-image"
                    href={`/products/${related.slug || related.id}`}
                  >
                    <img
                      className="product-hover-image primary"
                      src={optimizedImageUrl(related.image, 500)}
                      alt={related.name}
                      loading="lazy"
                    />
                  </a>
                </div>
                <div className="category-product-copy">
                  <small>{related.stone}</small>
                  <a href={`/products/${related.slug || related.id}`}>{related.name}</a>
                </div>
              </article>
            ))}
          </div>
          <p>
            <a href={`/kategori/${categoryToSlug(product.category)}`}>
              Tüm {product.category} ürünleri
            </a>
          </p>
        </section>
      )}
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
