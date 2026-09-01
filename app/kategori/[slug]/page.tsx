import type { Metadata } from "next";
import Link from "next/link";
import StoreSubpageHeader from "../../store-subpage-header";
import StoreSiteFooter from "../../store-site-footer";
import { FloatingSocialLinks } from "../../store-shared-chrome";
import StoreTrustBar from "../../store-trust-bar";
import { findCategoryBySlug } from "../../../lib/category-slugs";
import { findCategoryGroupBySlug, groupForCategory } from "../../../lib/category-groups";
import { subgroupsForGroup, tallyCategoryCounts } from "../../../lib/category-subgroups";
import type { Product } from "../../../lib/store-data";
import { readProducts, readSettings } from "../../../lib/store-db";
import QuickAddToCart from "../../quick-add-to-cart";

export const dynamic = "force-dynamic";

const SITE_URL = "https://www.terragolds.com";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ alt?: string }>;
};

/**
 * The [slug] segment accepts either a top-level nav group slug (e.g.
 * "kolyeler", spanning several raw categories) or a single raw category's
 * own slug — group match is checked first since it's the more specific,
 * curated nav entry point; single-category URLs keep working unchanged.
 *
 * For a group match, an optional `alt` subcategory slug (from the nav
 * dropdown) narrows the results further to one subgroup's raw category
 * values - subgroups are derived from the group's own products, the same
 * way the nav dropdown computes them, so the slug always resolves the same
 * set of raw categories here as it did when the link was built.
 */
function resolveCategoryOrGroup(products: Product[], slug: string, altSlug?: string) {
  const group = findCategoryGroupBySlug(slug);
  if (group) {
    const groupProducts = products.filter(
      (product) => groupForCategory(product.category)?.slug === group.slug,
    );
    if (altSlug) {
      const categoryCounts = tallyCategoryCounts(
        groupProducts.map((product) => product.category),
      );
      const subgroup = subgroupsForGroup(group, categoryCounts).find(
        (sub) => sub.slug === altSlug,
      );
      if (subgroup) {
        const categorySet = new Set(subgroup.categories);
        return {
          title: `${group.label} · ${subgroup.label}`,
          products: groupProducts.filter((product) => categorySet.has(product.category)),
        };
      }
    }
    return { title: group.label, products: groupProducts };
  }
  const categories = [...new Set(products.map((product) => product.category))];
  const category = findCategoryBySlug(categories, slug);
  if (!category) return null;
  return {
    title: category,
    products: products.filter((product) => product.category === category),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { alt } = await searchParams;
  const products = await readProducts();
  const resolved = resolveCategoryOrGroup(products, slug, alt);

  if (!resolved) {
    return {
      title: "Kategori Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const { title, products: categoryProducts } = resolved;
  const url = alt
    ? `${SITE_URL}/kategori/${slug}?alt=${alt}`
    : `${SITE_URL}/kategori/${slug}`;
  const heroImage = categoryProducts[0]?.image
    ? new URL(categoryProducts[0].image, SITE_URL).toString()
    : `${SITE_URL}/og.png`;
  const isStoneCategory = title === "Kristaller";
  const stoneNames = [
    ...new Set(categoryProducts.map((product) => product.stone).filter(Boolean)),
  ].slice(0, 3);
  const stoneText = stoneNames.length
    ? ` ${stoneNames.join(", ")} gibi doğal taşlardan üretilmiş`
    : "";
  const description = `${title} kategorisinde${stoneText} ${categoryProducts.length} seçilmiş ${isStoneCategory ? "doğal taş ürünü" : "ürün"}. Terragolds koleksiyonunu inceleyin.`;

  return {
    title: `${title} | Terragolds`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Terragolds`,
      description,
      url,
      type: "website",
      images: [{ url: heroImage, alt: `${title} Terragolds` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Terragolds`,
      description,
      images: [heroImage],
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { alt } = await searchParams;
  const [products, settings] = await Promise.all([
    readProducts(),
    readSettings(),
  ]);
  const resolved = resolveCategoryOrGroup(products, slug, alt);
  const title = resolved?.title ?? null;
  const categoryProducts = resolved?.products ?? [];

  const breadcrumbUrl = alt
    ? `${SITE_URL}/kategori/${slug}?alt=${alt}`
    : `${SITE_URL}/kategori/${slug}`;

  return (
    <main className="category-page">
      {title && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Ürünler", item: `${SITE_URL}/#shop` },
                { "@type": "ListItem", position: 3, name: title, item: breadcrumbUrl },
              ],
            }).replaceAll("<", "\\u003c"),
          }}
        />
      )}
      <StoreSubpageHeader activeGroupSlug={slug} />
      <StoreTrustBar />

      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span>/</span>
          <Link href="/#shop">Ürünler</Link>
          <span>/</span>
          <b>{title ?? "Kategori bulunamadı"}</b>
        </div>
        <p className="eyebrow">Koleksiyon</p>
        <h1>{title ?? "Kategori bulunamadı"}</h1>
        <p>
          {title
            ? `${categoryProducts.length} seçilmiş parça. Doğal form, yüzey ve renk karakteri korunmuş ürünleri inceleyin.`
            : "Aradığınız kategori bulunamadı. Tüm ürünlere geri dönebilirsiniz."}
        </p>
      </section>

      {title ? (
        <section className="category-products section-shell">
          <div className="category-grid">
            {categoryProducts.map((product, index) => {
              const imageLoading = index < 6 ? "eager" : "lazy";
              return (
                <article className="category-product-card" key={product.id}>
                  <Link
                    className={`category-product-image${
                      product.hoverImage ? " has-hover-image" : ""
                    }`}
                    href={`/products/${product.slug || product.id}`}
                    aria-label={`${product.name} detaylarını gör`}
                  >
                    {product.stock > 0 && product.stock <= 3 ? (
                      <span>Son parçalar</span>
                    ) : product.discountPercent > 0 ? (
                      <span>%{product.discountPercent} indirim</span>
                    ) : product.badge ? (
                      <em>{product.badge}</em>
                    ) : null}
                    {product.hoverImage && (
                      <>
                        <i className="product-hover-zone left" />
                        <i className="product-hover-zone right" />
                      </>
                    )}
                    <img
                      className="product-hover-image primary"
                      src={product.image}
                      alt={product.name}
                      loading={imageLoading}
                    />
                    {product.hoverImage && (
                      <img
                        className="product-hover-image secondary"
                        src={product.hoverImage}
                        alt=""
                        loading={imageLoading}
                      />
                    )}
                    {product.hoverImage && (
                      <span className="product-image-progress" aria-hidden="true">
                        <i className="left" />
                        <i className="right" />
                      </span>
                    )}
                  </Link>
                  <div className="category-product-copy">
                    <small>{product.stone}</small>
                    <Link href={`/products/${product.slug || product.id}`}>{product.name}</Link>
                    <p>{product.description}</p>
                    <QuickAddToCart product={product} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="category-products section-shell">
          <Link className="button button-dark" href="/#shop">
            Tüm ürünlere dön
          </Link>
        </section>
      )}
      <StoreSiteFooter
        businessName={settings.businessName}
        address={[settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(", ")}
      />
      <FloatingSocialLinks />
    </main>
  );
}
