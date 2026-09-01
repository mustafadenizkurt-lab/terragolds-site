"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import StoreTrustBar from "../store-trust-bar";
import {
  getDiscountedPrice,
  type Product,
} from "../../lib/store-data";
import { syncFavorites } from "../../lib/favorite-client";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function stars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating);
}

function collectionMessage(product: Product) {
  if (product.campaignLabel) {
    return `${product.campaignLabel} · Sınırlı koleksiyon`;
  }
  if (product.stock <= 3) return `Koleksiyonluk son ${product.stock} parça`;
  return "Seçkin koleksiyondan özel parça";
}

export default function FavoritesClient({
  businessName,
  businessAddress,
}: {
  businessName?: string;
  businessAddress?: string;
} = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [liked, setLiked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetch("/api/store", { cache: "no-store" })
      .then(
        (response) => response.json() as Promise<{ products?: Product[] }>,
      )
      .then((payload) => setProducts(payload.products ?? []))
      .finally(() => setLoading(false));
  }, []);

  const favorites = useMemo(
    () => products.filter((product) => liked.includes(product.id)),
    [liked, products],
  );

  const removeFavorite = (productId: number) => {
    const next = liked.filter((id) => id !== productId);
    setLiked(next);
    window.localStorage.setItem("terragolds-liked", JSON.stringify(next));
    window.dispatchEvent(new Event("terragolds-storage"));
    syncFavorites(next);
  };

  return (
    <main className="favorites-page">
      <StoreSubpageHeader active="favorites" />
      <StoreTrustBar />
      <section className="favorites-content section-shell">
        <div className="favorites-title">
          <p className="eyebrow">Kişisel seçkiniz</p>
          <h1>Favorilerim</h1>
          <span>
            Daha sonra incelemek istediğiniz doğal ve benzersiz parçalar.
          </span>
        </div>

        {loading ? (
          <div className="favorites-empty">Favorileriniz hazırlanıyor…</div>
        ) : favorites.length === 0 ? (
          <div className="favorites-empty">
            <span aria-hidden="true">♡</span>
            <h2>Favori listeniz henüz boş</h2>
            <p>Beğendiğiniz ürünlerdeki kalp simgesine dokunarak başlayın.</p>
            <Link href="/#shop">Ürünleri keşfet</Link>
          </div>
        ) : (
          <div className="favorites-grid">
            {favorites.map((product, index) => (
              <article className="favorite-card" key={product.id}>
                <div className="favorite-card-image">
                  <Link href={`/products/${product.slug || product.id}`}>
                    <img
                      src={product.image}
                      alt={product.name}
                      loading={index < 6 ? "eager" : "lazy"}
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeFavorite(product.id)}
                    aria-label={`${product.name} ürününü favorilerden çıkar`}
                  >
                    ♥
                  </button>
                </div>
                <p>{collectionMessage(product)}</p>
                <Link className="favorite-card-copy" href={`/products/${product.slug || product.id}`}>
                  <small>{product.stone}</small>
                  <h2>{product.name}</h2>
                  <span className="favorite-card-rating">
                    {stars(Math.round(product.reviewAverage ?? 0))}
                    <b>({product.reviewCount ?? 0})</b>
                  </span>
                  <div>
                    {product.discountPercent > 0 && (
                      <del>{money.format(product.price)}</del>
                    )}
                    <strong>{money.format(getDiscountedPrice(product))}</strong>
                  </div>
                </Link>
                <Link className="favorite-detail-link" href={`/products/${product.slug || product.id}`}>
                  Ürünü incele
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      <StoreSiteFooter businessName={businessName} address={businessAddress} />
    </main>
  );
}
