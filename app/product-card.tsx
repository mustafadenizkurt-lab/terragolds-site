"use client";

import type { Product } from "../lib/store-data";
import QuickAddToCart from "./quick-add-to-cart";

/**
 * Minimal subset of home-client.tsx's uiText[Language] that ProductCard
 * actually reads - callers outside the homepage (which has no language
 * switcher) can pass just these four Turkish strings instead of the full
 * i18n object.
 */
export type ProductCardUi = {
  lowStockBadge: string;
  discount: string;
  discountOpportunity: string;
  newProduct: string;
};

export const defaultProductCardUi: ProductCardUi = {
  lowStockBadge: "Son parçalar",
  discount: "İNDİRİM",
  discountOpportunity: "İndirim Fırsatı",
  newProduct: "Yeni ürün",
};

function ratingStars(rating: number) {
  const roundedRating = Math.max(0, Math.min(5, Math.round(rating)));
  return "★★★★★".slice(0, roundedRating) + "☆☆☆☆☆".slice(roundedRating);
}

function productCollectionMessage(product: Product) {
  if (product.campaignLabel) {
    return `${product.campaignLabel} · Sınırlı koleksiyon avantajı`;
  }
  if (product.stock <= 3) {
    return `Koleksiyonluk son ${product.stock} parça`;
  }
  return "Seçkin koleksiyondan özel parça";
}

/**
 * The one shared product grid card - used by the homepage catalog/showcase
 * sections and category pages alike, so the two never drift into
 * inconsistent grid/card layouts again.
 */
export default function ProductCard({
  product,
  ui = defaultProductCardUi,
  isLiked,
  onToggleLike,
  loading = "lazy",
}: {
  product: Product;
  ui?: ProductCardUi;
  isLiked: boolean;
  onToggleLike: () => void;
  loading?: "eager" | "lazy";
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <div className="product-label-stack">
          {product.stock > 0 && product.stock <= 3 && (
            <span className="product-low-stock-badge">
              {ui.lowStockBadge}
            </span>
          )}
          {product.stock > 3 && product.discountPercent > 0 && (
            <span className="product-sale-badge">
              <strong>%{product.discountPercent} {ui.discount}</strong>
              <small>{product.campaignLabel || ui.discountOpportunity}</small>
            </span>
          )}
          {product.stock > 3 && product.discountPercent <= 0 && product.badge && (
            <span className="product-badge">{product.badge}</span>
          )}
        </div>
        <span className="product-certified-badge">
          <b aria-hidden="true">✓</b> Sertifikalı
        </span>
        <button
          type="button"
          className={isLiked ? "heart liked" : "heart"}
          onClick={onToggleLike}
          aria-label={
            isLiked
              ? `${product.name} favorilerden çıkar`
              : `${product.name} favorilere ekle`
          }
        >
          {isLiked ? "♥" : "♡"}
        </button>
        <a
          className={`product-image-button${
            product.hoverImage ? " has-hover-image" : ""
          }`}
          href={`/products/${product.slug || product.id}`}
          aria-label={`${product.name} ayrıntılarını gör`}
        >
          {product.hoverImage && (
            <>
              <span className="product-hover-zone left" />
              <span className="product-hover-zone right" />
            </>
          )}
          <img
            className="product-hover-image primary"
            src={product.image}
            alt={product.name}
            loading={loading}
          />
          {product.hoverImage && (
            <img
              className="product-hover-image secondary"
              src={product.hoverImage}
              alt=""
              loading={loading}
            />
          )}
          {product.hoverImage && (
            <span className="product-image-progress" aria-hidden="true">
              <i className="left" />
              <i className="right" />
            </span>
          )}
        </a>
        <span
          className="product-image-rating product-card-rating"
          aria-label={`${product.reviewAverage ?? 0} puan, ${
            product.reviewCount ?? 0
          } yorum`}
        >
          {product.reviewCount ? (
            <b aria-hidden="true">{ratingStars(product.reviewAverage ?? 0)}</b>
          ) : null}
          <em>
            {product.reviewCount ? `(${product.reviewCount})` : ui.newProduct}
          </em>
        </span>
      </div>
      <p className="product-collection-highlight">
        {productCollectionMessage(product)}
      </p>
      <a className="product-info" href={`/products/${product.slug || product.id}`}>
        <span className="product-info-copy">
          <small>{product.stone}</small>
          <strong>{product.name}</strong>
        </span>
      </a>
      <QuickAddToCart product={product} />
    </article>
  );
}
