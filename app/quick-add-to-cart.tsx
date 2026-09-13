"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { getDiscountedPrice, type Product } from "../lib/store-data";
import { useCart } from "../lib/cart-context";

// "134,90 ₺" - number first, currency symbol after, matching the reference
// site's format (Intl's default tr-TR/TRY currency style puts the symbol
// first, so the symbol is appended manually instead of using style: "currency").
const priceNumberFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatPrice(value: number) {
  return `${priceNumberFormat.format(value)} ₺`;
}

/**
 * Price + quantity stepper + "add to cart" button shown under the name on
 * every product grid card (homepage and category listings) - the one
 * shared component both grids use, so the price format and cart button
 * never drift between them. Quantity is local to each card instance.
 */
export default function QuickAddToCart({ product }: { product: Product }) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const soldOut = product.stock <= 0;
  const maxQuantity = Math.max(1, Math.min(product.stock, 20));
  const discountedPrice = getDiscountedPrice(product);

  const setClampedQuantity = (next: number) => {
    setQuantity(Math.min(maxQuantity, Math.max(1, Math.round(next) || 1)));
  };

  return (
    <div className="quick-add-block">
      <div className={`quick-add-price${product.discountPercent > 0 ? " discounted" : ""}`}>
        {product.discountPercent > 0 && <del>{formatPrice(product.price)}</del>}
        <strong>{formatPrice(discountedPrice)}</strong>
      </div>
      <div className="quick-add-row">
        <div className="quick-add-qty">
          <button
            type="button"
            onClick={() => setClampedQuantity(quantity - 1)}
            disabled={soldOut || quantity <= 1}
            aria-label={`${product.name} adedini azalt`}
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            onClick={() => setClampedQuantity(quantity + 1)}
            disabled={soldOut || quantity >= maxQuantity}
            aria-label={`${product.name} adedini artır`}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="quick-add-bag"
          onClick={() => cart.addToCart(product, quantity)}
          disabled={soldOut || cart.addCooldownSeconds > 0}
          aria-label={soldOut ? `${product.name} tükendi` : `${product.name} sepete ekle`}
        >
          <ShoppingBag aria-hidden="true" size={16} strokeWidth={2} />
          <span>Ekle</span>
        </button>
      </div>
    </div>
  );
}
