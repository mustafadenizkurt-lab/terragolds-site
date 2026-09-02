"use client";

import { useEffect, useState } from "react";
import ProductCard from "../product-card";
import { syncFavorites } from "../../lib/favorite-client";
import type { Product } from "../../lib/store-data";

/**
 * Same product-grid/ProductCard the homepage catalog uses (app/home-client.tsx)
 * - kept as one shared component so category pages and "Tüm Ürünler" never
 * drift into inconsistent grid/card layouts again. A thin client wrapper is
 * needed here only because the favorite heart toggle is client-side,
 * localStorage-backed state; the category page itself stays a server
 * component.
 */
export default function CategoryProductGrid({
  products,
}: {
  products: Product[];
}) {
  const [liked, setLiked] = useState<number[]>([]);

  useEffect(() => {
    let storedLikes: number[] = [];
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("terragolds-liked") ?? "[]",
      ) as unknown;
      storedLikes = Array.isArray(stored)
        ? stored.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];
    } catch {
      storedLikes = [];
    }
    Promise.resolve().then(() => setLiked(storedLikes));
    syncFavorites(storedLikes);
  }, []);

  const toggleLike = (id: number) => {
    setLiked((current) => {
      const next = current.includes(id)
        ? current.filter((productId) => productId !== id)
        : [...current, id];
      window.localStorage.setItem("terragolds-liked", JSON.stringify(next));
      window.dispatchEvent(new Event("terragolds-storage"));
      syncFavorites(next);
      return next;
    });
  };

  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          isLiked={liked.includes(product.id)}
          onToggleLike={() => toggleLike(product.id)}
          loading={index < 6 ? "eager" : "lazy"}
        />
      ))}
    </div>
  );
}
