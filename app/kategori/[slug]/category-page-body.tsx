"use client";

import Link from "next/link";
import type { Product } from "../../../lib/store-data";
import { useLanguage } from "../../../lib/language-client";
import QuickAddToCart from "../../quick-add-to-cart";
import FavoriteHeartButton from "../../favorite-heart-button";
import CompareToggleButton from "../../compare-toggle-button";

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
  },
} as const;

export default function CategoryPageBody({
  title,
  products,
}: {
  title: string | null;
  products: Product[];
}) {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <>
      <section className="category-hero section-shell">
        <div className="category-breadcrumb">
          <Link href="/">{t.home}</Link>
          <span>/</span>
          <Link href="/#shop">{t.products}</Link>
          <span>/</span>
          <b>{title ?? t.notFoundTitle}</b>
        </div>
        <p className="eyebrow">{t.collection}</p>
        <h1>{title ?? t.notFoundTitle}</h1>
        <p>{title ? t.piecesSelected(products.length) : t.notFoundDetail}</p>
      </section>

      {title ? (
        <section className="category-products section-shell">
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
