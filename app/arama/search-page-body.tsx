"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import type { Product } from "../../lib/store-data";
import { useLanguage } from "../../lib/language-client";
import QuickAddToCart from "../quick-add-to-cart";
import QuickViewModal from "../quick-view-modal";
import FavoriteHeartButton from "../favorite-heart-button";
import CompareToggleButton from "../compare-toggle-button";
import { optimizedImageUrl } from "../../lib/image-transform";
import { buildPageWindow } from "../../lib/pagination";
import { useScrollRestoration } from "../../lib/use-scroll-restoration";

const copy = {
  tr: {
    home: "Ana Sayfa",
    products: "Ürünler",
    resultsFor: (query: string) => `"${query}" için sonuçlar`,
    searchTitle: "Arama",
    piecesFound: (count: number) => `${count} ürün bulundu.`,
    notFoundTitle: "Aradığınız kelimeyle eşleşen ürün bulunamadı",
    notFoundDetail: "Farklı bir kelime deneyebilir veya tüm ürünlere göz atabilirsiniz.",
    viewDetails: (name: string) => `${name} detaylarını gör`,
    lastPieces: "Son parçalar",
    discount: (percent: number) => `%${percent} indirim`,
    backToAllProducts: "Tüm ürünlere dön",
    previousPage: "Önceki",
    nextPage: "Sonraki",
    pageStatus: (page: number, total: number) => `${page}. sayfa / ${total}`,
    sortBy: "Sırala",
    sortDefault: "Önerilen sıralama",
    sortPriceAsc: "Fiyat: Düşükten Yükseğe",
    sortPriceDesc: "Fiyat: Yüksekten Düşüğe",
    sortNewest: "En Yeniler",
    sortNameAsc: "İsim: A-Z",
    quickView: (name: string) => `${name} ürününü hızlı görüntüle`,
  },
  en: {
    home: "Home",
    products: "Products",
    resultsFor: (query: string) => `Results for "${query}"`,
    searchTitle: "Search",
    piecesFound: (count: number) => `${count} products found.`,
    notFoundTitle: "No products matched your search",
    notFoundDetail: "Try another word or browse all products instead.",
    viewDetails: (name: string) => `View ${name} details`,
    lastPieces: "Last pieces",
    discount: (percent: number) => `${percent}% off`,
    backToAllProducts: "Back to all products",
    previousPage: "Previous",
    nextPage: "Next",
    pageStatus: (page: number, total: number) => `Page ${page} / ${total}`,
    sortBy: "Sort by",
    sortDefault: "Recommended order",
    sortPriceAsc: "Price: Low to High",
    sortPriceDesc: "Price: High to Low",
    sortNewest: "Newest",
    sortNameAsc: "Name: A-Z",
    quickView: (name: string) => `Quick view ${name}`,
  },
} as const;

export default function SearchPageBody({
  query,
  products,
  totalCount,
  page,
  totalPages,
  sort,
}: {
  query: string;
  products: Product[];
  totalCount: number;
  page: number;
  totalPages: number;
  sort?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  // Keyed by query so switching search terms never restores a scroll
  // position saved for a different query (same pattern as the category
  // page's per-slug key).
  useScrollRestoration(`terragolds-search-scroll-y:${query}`);

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort) params.set("sirala", sort);
    if (targetPage > 1) params.set("sayfa", String(targetPage));
    const search = params.toString();
    return `/arama${search ? `?${search}` : ""}`;
  };
  const pageWindow = buildPageWindow(page, totalPages);
  const hasQuery = query.length > 0;

  return (
    <>
      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">{t.home}</Link>
          <span>/</span>
          <Link href="/#shop">{t.products}</Link>
          <span>/</span>
          <b>{t.searchTitle}</b>
        </div>
        <p className="eyebrow">{t.searchTitle}</p>
        <h1>{hasQuery ? t.resultsFor(query) : t.searchTitle}</h1>
        {hasQuery && <p>{t.piecesFound(totalCount)}</p>}
      </section>

      {products.length > 0 ? (
        <section className="category-products section-shell">
          <form className="catalog-sort" action="/arama" method="get">
            {query && <input type="hidden" name="q" value={query} />}
            <label>
              <span>{t.sortBy}</span>
              <select
                name="sirala"
                defaultValue={sort ?? ""}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              >
                <option value="">{t.sortDefault}</option>
                <option value="fiyat-artan">{t.sortPriceAsc}</option>
                <option value="fiyat-azalan">{t.sortPriceDesc}</option>
                <option value="yeni">{t.sortNewest}</option>
                <option value="isim-az">{t.sortNameAsc}</option>
              </select>
            </label>
          </form>
          <div className="category-grid">
            {products.map((product, index) => {
              const imageLoading = index < 6 ? "eager" : "lazy";
              return (
                <article className="category-product-card" key={product.id}>
                  <div className="category-product-image-wrap">
                    <FavoriteHeartButton productId={product.id} productName={product.name} />
                    <button
                      type="button"
                      className="quick-view-btn"
                      onClick={() => setQuickViewProduct(product)}
                      aria-label={t.quickView(product.name)}
                    >
                      <Eye aria-hidden="true" size={17} strokeWidth={2} />
                    </button>
                    {/* Plain <a>, not next/link's <Link> - same reasoning as
                        the category page grid: vinext's Link shim commits
                        browser history asynchronously, which a quick tap
                        into a product can outrace (see category-page-body's
                        longer note on this). */}
                    <a
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
                    </a>
                  </div>
                  <div className="category-product-copy">
                    <small>{product.stone}</small>
                    {product.xmlExternalId && (
                      <span className="product-code">#{product.xmlExternalId}</span>
                    )}
                    <a href={`/products/${product.slug || product.id}`}>{product.name}</a>
                    <CompareToggleButton productId={product.id} productName={product.name} />
                    <QuickAddToCart product={product} />
                  </div>
                </article>
              );
            })}
          </div>
          {totalPages > 1 && (
            <nav className="catalog-pagination" aria-label={t.pageStatus(page, totalPages)}>
              <a
                href={buildHref(page - 1)}
                aria-disabled={page === 1}
                onClick={(event) => {
                  if (page === 1) event.preventDefault();
                }}
              >
                {t.previousPage}
              </a>
              <div>
                {pageWindow.map((item) =>
                  typeof item === "number" ? (
                    <a
                      href={buildHref(item)}
                      className={item === page ? "active" : ""}
                      key={item}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </a>
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
              <a
                href={buildHref(page + 1)}
                aria-disabled={page === totalPages}
                onClick={(event) => {
                  if (page === totalPages) event.preventDefault();
                }}
              >
                {t.nextPage}
              </a>
            </nav>
          )}
        </section>
      ) : (
        <section className="category-products section-shell">
          <div className="category-hero" style={{ padding: 0 }}>
            <p>{hasQuery ? t.notFoundTitle : ""}</p>
            {hasQuery && <p>{t.notFoundDetail}</p>}
          </div>
          <Link className="button button-dark" href="/#shop">
            {t.backToAllProducts}
          </Link>
        </section>
      )}
      {quickViewProduct && (
        <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      )}
    </>
  );
}
