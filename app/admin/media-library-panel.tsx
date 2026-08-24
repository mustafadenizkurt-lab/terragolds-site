"use client";

import { useMemo, useState } from "react";
import type { Product } from "../../lib/store-data";
import type { ProductCategory } from "../../lib/category-types";

const UNCATEGORIZED = "__uncategorized__";

type MediaItem = {
  src: string;
  title: string;
  usedBy: number;
  category: string | null;
};

export default function MediaLibraryPanel({
  products,
  categories,
  onOpenProduct,
}: {
  products: Product[];
  categories: ProductCategory[];
  onOpenProduct: (productId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const knownCategoryNames = useMemo(
    () => new Set(categories.map((category) => category.name)),
    [categories],
  );

  const media = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const product of products) {
      for (const src of [product.image, product.hoverImage].filter(Boolean)) {
        if (!src) continue;
        const existing = map.get(src);
        if (existing) {
          existing.usedBy += 1;
        } else {
          map.set(src, {
            src,
            title: product.name,
            usedBy: 1,
            category: knownCategoryNames.has(product.category)
              ? product.category
              : null,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [products, knownCategoryNames]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of media) {
      const key = item.category ?? UNCATEGORIZED;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [media]);

  const hasUncategorized = (categoryCounts.get(UNCATEGORIZED) ?? 0) > 0;

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filteredMedia = media.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      [item.title, item.src]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery);
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === UNCATEGORIZED
        ? item.category === null
        : item.category === categoryFilter);
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="admin-workbench">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Görsel arşivi</p>
            <h2>Medya kütüphanesi</h2>
          </div>
          <span className="admin-soft-count">{media.length} görsel</span>
        </div>

        <div className="admin-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Görsel veya ürün adı ara"
          />
        </div>

        <div className="admin-media-tabs" role="tablist" aria-label="Kategoriye göre filtrele">
          <button
            type="button"
            className={categoryFilter === "all" ? "active" : ""}
            onClick={() => setCategoryFilter("all")}
          >
            Tümü <small>{media.length}</small>
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={categoryFilter === category.name ? "active" : ""}
              onClick={() => setCategoryFilter(category.name)}
            >
              {category.name} <small>{categoryCounts.get(category.name) ?? 0}</small>
            </button>
          ))}
          {hasUncategorized && (
            <button
              type="button"
              className={categoryFilter === UNCATEGORIZED ? "active" : ""}
              onClick={() => setCategoryFilter(UNCATEGORIZED)}
            >
              Kategorisiz <small>{categoryCounts.get(UNCATEGORIZED) ?? 0}</small>
            </button>
          )}
        </div>

        <div className="admin-media-grid">
          {filteredMedia.map((item) => {
            const product = products.find(
              (candidate) =>
                candidate.image === item.src || candidate.hoverImage === item.src,
            );
            return (
              <article key={item.src}>
                <img src={item.src} alt={item.title} />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.usedBy} yerde kullanılıyor</small>
                  <code>{item.src}</code>
                  {product && (
                    <button type="button" onClick={() => onOpenProduct(product.id)}>
                      Ürünü düzenle
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {filteredMedia.length === 0 && (
            <p className="admin-media-empty">
              Bu kategoride görsel bulunmuyor.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
