"use client";

import Link from "next/link";
import type { Product } from "../../../lib/store-data";
import { useLanguage } from "../../../lib/language-client";
import QuickAddToCart from "../../quick-add-to-cart";
import FavoriteHeartButton from "../../favorite-heart-button";
import CompareToggleButton from "../../compare-toggle-button";
import { optimizedImageUrl } from "../../../lib/image-transform";
import { buildPageWindow } from "../../../lib/pagination";
import { MATERIAL_FACETS, COLOR_FACETS } from "../../../lib/product-facets";

const copy = {
  tr: {
    home: "Ana Sayfa",
    products: "Ürünler",
    notFoundTitle: "Kategori bulunamadı",
    collection: "Koleksiyon",
    piecesSelected: (count: number) =>
      `${count} seçilmiş parça. Kaliteli işçilik ve özenli tasarımlarla hazırlanmış ürünleri inceleyin.`,
    notFoundDetail: "Aradığınız kategori bulunamadı. Tüm ürünlere geri dönebilirsiniz.",
    viewDetails: (name: string) => `${name} detaylarını gör`,
    lastPieces: "Son parçalar",
    discount: (percent: number) => `%${percent} indirim`,
    backToAllProducts: "Tüm ürünlere dön",
    previousPage: "Önceki",
    nextPage: "Sonraki",
    pageStatus: (page: number, total: number) => `${page}. sayfa / ${total}`,
    material: "Malzeme",
    color: "Renk",
    all: "Tümü",
  },
  en: {
    home: "Home",
    products: "Products",
    notFoundTitle: "Category not found",
    collection: "Collection",
    piecesSelected: (count: number) =>
      `${count} selected pieces. Browse products crafted with quality workmanship and careful design.`,
    notFoundDetail: "We couldn't find that category. You can go back to all products.",
    viewDetails: (name: string) => `View ${name} details`,
    lastPieces: "Last pieces",
    discount: (percent: number) => `${percent}% off`,
    backToAllProducts: "Back to all products",
    previousPage: "Previous",
    nextPage: "Next",
    pageStatus: (page: number, total: number) => `Page ${page} / ${total}`,
    material: "Material",
    color: "Color",
    all: "All",
  },
} as const;

export default function CategoryPageBody({
  title,
  titleEn,
  products,
  totalCount,
  page,
  totalPages,
  slug,
  alt,
  material,
  color,
}: {
  title: string | null;
  titleEn?: string | null;
  products: Product[];
  totalCount: number;
  page: number;
  totalPages: number;
  slug: string;
  alt?: string;
  material?: string;
  color?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  // Curated nav-group names have a real English label (titleEn); a raw,
  // supplier-entered single category doesn't, so it stays Turkish even in
  // English mode - see lib/i18n.ts's note on untranslated catalog data.
  const displayTitle = (language === "en" && titleEn ? titleEn : title) ?? null;
  const pageWindow = buildPageWindow(page, totalPages);
  const buildHref = (overrides: {
    page?: number;
    material?: string;
    color?: string;
  }) => {
    const params = new URLSearchParams();
    if (alt) params.set("alt", alt);
    const nextMaterial = overrides.material !== undefined ? overrides.material : material;
    const nextColor = overrides.color !== undefined ? overrides.color : color;
    if (nextMaterial) params.set("malzeme", nextMaterial);
    if (nextColor) params.set("renk", nextColor);
    const targetPage = overrides.page ?? page;
    if (targetPage > 1) params.set("sayfa", String(targetPage));
    const query = params.toString();
    return `/kategori/${slug}${query ? `?${query}` : ""}`;
  };
  const pageHref = (targetPage: number) => buildHref({ page: targetPage });

  return (
    <>
      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">{t.home}</Link>
          <span>/</span>
          <Link href="/#shop">{t.products}</Link>
          <span>/</span>
          <b>{displayTitle ?? t.notFoundTitle}</b>
        </div>
        <p className="eyebrow">{t.collection}</p>
        <h1>{displayTitle ?? t.notFoundTitle}</h1>
        <p>{title ? t.piecesSelected(totalCount) : t.notFoundDetail}</p>
      </section>

      {title ? (
        <section className="category-products section-shell">
          <div className="catalog-filter-group">
            <span>{t.material}</span>
            <div className="filters" role="group" aria-label={t.material}>
              <Link
                href={buildHref({ material: "", page: 1 })}
                className={!material ? "filter active" : "filter"}
              >
                <span>{t.all}</span>
              </Link>
              {MATERIAL_FACETS.map((facet) => (
                <Link
                  key={facet.key}
                  href={buildHref({ material: facet.key, page: 1 })}
                  className={material === facet.key ? "filter active" : "filter"}
                >
                  <span>{facet.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="catalog-filter-group">
            <span>{t.color}</span>
            <div className="filters" role="group" aria-label={t.color}>
              <Link
                href={buildHref({ color: "", page: 1 })}
                className={!color ? "filter active" : "filter"}
              >
                <span>{t.all}</span>
              </Link>
              {COLOR_FACETS.map((facet) => (
                <Link
                  key={facet.key}
                  href={buildHref({ color: facet.key, page: 1 })}
                  className={color === facet.key ? "filter active" : "filter"}
                >
                  <span>{facet.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="category-grid">
            {products.map((product, index) => {
              const imageLoading = index < 6 ? "eager" : "lazy";
              return (
                <article className="category-product-card" key={product.id}>
                  <div className="category-product-image-wrap">
                    <FavoriteHeartButton productId={product.id} productName={product.name} />
                    <Link
                      className={`category-product-image${
                        product.hoverImage ? " has-hover-image" : ""
                      }`}
                      href={`/products/${product.slug || product.id}`}
                      aria-label={t.viewDetails(product.name)}
                    >
                      {product.stock > 0 && product.stock <= 3 ? (
                        <span>{t.lastPieces}</span>
                      ) : product.discountPercent > 0 ? (
                        <span>{t.discount(product.discountPercent)}</span>
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
                        src={optimizedImageUrl(product.image, 500)}
                        alt={product.name}
                        loading={imageLoading}
                      />
                      {product.hoverImage && (
                        <img
                          className="product-hover-image secondary"
                          src={optimizedImageUrl(product.hoverImage, 500)}
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
                  </div>
                  <div className="category-product-copy">
                    <small>{product.stone}</small>
                    {product.xmlExternalId && (
                      <span className="product-code">#{product.xmlExternalId}</span>
                    )}
                    <Link href={`/products/${product.slug || product.id}`}>{product.name}</Link>
                    <CompareToggleButton productId={product.id} productName={product.name} />
                    <QuickAddToCart product={product} />
                  </div>
                </article>
              );
            })}
          </div>
          {totalPages > 1 && (
            <nav className="catalog-pagination" aria-label={t.pageStatus(page, totalPages)}>
              <Link
                href={pageHref(page - 1)}
                aria-disabled={page === 1}
                onClick={(event) => {
                  if (page === 1) event.preventDefault();
                }}
              >
                {t.previousPage}
              </Link>
              <div>
                {pageWindow.map((item) =>
                  typeof item === "number" ? (
                    <Link
                      href={pageHref(item)}
                      className={item === page ? "active" : ""}
                      key={item}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </Link>
                  ) : (
                    <span
                      className="catalog-pagination-ellipsis"
                      key={item}
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ),
                )}
              </div>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page === totalPages}
                onClick={(event) => {
                  if (page === totalPages) event.preventDefault();
                }}
              >
                {t.nextPage}
              </Link>
            </nav>
          )}
        </section>
      ) : (
        <section className="category-products section-shell">
          <Link className="button button-dark" href="/#shop">
            {t.backToAllProducts}
          </Link>
        </section>
      )}
    </>
  );
}
