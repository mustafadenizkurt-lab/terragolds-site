"use client";

import type { Product } from "../lib/store-data";
import { useLanguage } from "../lib/language-client";
import { decodeHtmlEntities } from "../lib/text-utils";
import { optimizedImageUrl } from "../lib/image-transform";
import QuickAddToCart from "./quick-add-to-cart";

const copy = {
  tr: {
    close: "Kapat",
    productDetails: (name: string) => `${name} ürün ayrıntıları`,
    discount: "İNDİRİM",
    discountOpportunity: "İndirim Fırsatı",
    bullets: [
      "Özenli işçilik ve kaliteli malzeme",
      "Özenli, koruyucu paketleme",
      "Parçaya özel bakım notu",
    ],
  },
  en: {
    close: "Close",
    productDetails: (name: string) => `${name} product details`,
    discount: "OFF",
    discountOpportunity: "Sale Opportunity",
    bullets: [
      "Careful craftsmanship and quality materials",
      "Careful protective packaging",
      "Piece-specific care note",
    ],
  },
} as const;

/**
 * Shared "quick view" popup for product-grid cards (homepage and category
 * listings) - shows the product without leaving the grid. Purchase controls
 * are QuickAddToCart itself (same component already used on every card), so
 * this stays self-contained: no cart/quantity plumbing needed from callers,
 * just a product and a close handler.
 */
export default function QuickViewModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [language] = useLanguage();
  const t = copy[language];

  return (
    <div className="overlay product-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.productDetails(product.name)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <div className="modal-image">
          {product.discountPercent > 0 && (
            <span className="modal-sale-badge">
              %{product.discountPercent} {t.discount} ·{" "}
              {product.campaignLabel || t.discountOpportunity}
            </span>
          )}
          <img src={optimizedImageUrl(product.image, 700)} alt={product.name} />
        </div>
        <div className="modal-copy">
          <p className="eyebrow">{product.category}</p>
          <h2>{product.name}</h2>
          <p>{decodeHtmlEntities(product.description)}</p>
          <ul>
            {t.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <QuickAddToCart product={product} />
        </div>
      </section>
    </div>
  );
}
