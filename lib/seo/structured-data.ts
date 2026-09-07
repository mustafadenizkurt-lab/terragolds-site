// Shared JSON-LD (schema.org) builders for the storefront.
//
// Rules these builders follow (see /docs/geo-product-audit.md):
// - Every field is sourced from real data (store_settings, the products
//   table, or site_content) - never a placeholder, invented rating, or
//   invented review.
// - No `aggregateRating`/`review` unless a product actually has reviews
//   (see productSchema below - it only appears when reviewCount > 0).
// - No `potentialAction` (SearchAction) on WebSiteSchema: the storefront's
//   search is a client-side hash deep link (`/#shop?search=...`), not a
//   real crawlable query-string results page, so declaring a
//   SearchAction would describe a capability that doesn't actually work
//   for a bot. Add one only once a real `/?search=` (or similar) SSR
//   results route exists.
import type { StoreSettings } from "../store-data";

export const SITE_URL = "https://www.terragolds.com";
export const SITE_NAME = "Terragolds";

function contactSettings(settings: StoreSettings) {
  const address = [settings.address, settings.district, settings.city]
    .filter(Boolean)
    .join(", ");
  return { address, phone: settings.phone, email: settings.email };
}

/**
 * schema.org/Organization for the brand itself - used once, site-wide
 * (root layout), not repeated per page.
 */
export function organizationSchema(settings: StoreSettings) {
  const { address, phone, email } = contactSettings(settings);
  const sameAs = [
    settings.instagram,
    settings.facebook,
    settings.tiktok,
    settings.pinterest,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.businessName || SITE_NAME,
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og.png`,
    ...(email ? { email } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.address || undefined,
            addressLocality: settings.district || undefined,
            addressRegion: settings.city || undefined,
            addressCountry: "TR",
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** schema.org/WebSite - one instance, site-wide. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "tr-TR",
  };
}

export type FaqEntry = { question: string; answer: string };

/** schema.org/FAQPage - only for a page whose visible content is exactly this Q&A list. */
export function faqPageSchema(entries: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

export type BreadcrumbEntry = { name: string; url: string };

/** schema.org/BreadcrumbList for any page with a visible breadcrumb trail. */
export function breadcrumbSchema(entries: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}

export type ProductSchemaInput = {
  id: number;
  name: string;
  description: string;
  image: string;
  hoverImage?: string | null;
  category: string;
  slug?: string;
  price: number;
  stock: number;
  reviewAverage?: number;
  reviewCount?: number;
};

/** schema.org/Product for a single product detail page. */
export function productSchema(product: ProductSchemaInput) {
  const url = `${SITE_URL}/products/${product.slug || product.id}`;
  const images = [product.image, product.hoverImage]
    .filter((value): value is string => Boolean(value))
    .map((image) => new URL(image, SITE_URL).toString());

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images,
    sku: `TG-${product.id}`,
    category: product.category,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "TRY",
      price: product.price.toFixed(2),
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
  };
}

/** Safely serialize a JSON-LD object for a <script> tag (escapes `<` to prevent premature tag closing / XSS). */
export function toJsonLd(data: unknown) {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
