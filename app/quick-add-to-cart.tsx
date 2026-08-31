"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { Product } from "../lib/store-data";
import { useCart } from "../lib/cart-context";

/**
 * Quantity stepper + icon-only "add to cart" button shown under the
 * name/price on every product grid card (homepage and category listings).
 * Quantity is local to each card instance, so two cards never share state.
 */
export default function QuickAddToCart({ product }: { product: Product }) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const soldOut = product.stock <= 0;
  const maxQuantity = Math.max(1, Math.min(product.stock, 20));

  const setClampedQuantity = (next: number) => {
    setQuantity(Math.min(maxQuantity, Math.max(1, Math.round(next) || 1)));
  };

  return (
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
        <ShoppingBag aria-hidden="true" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
