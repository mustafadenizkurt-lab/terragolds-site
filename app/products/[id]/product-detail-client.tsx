"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StoreSubpageHeader from "../../store-subpage-header";
import {
  getDiscountedPrice,
  type Product,
} from "../../../lib/store-data";
import { syncFavorites } from "../../../lib/favorite-client";
import { useCart } from "../../../lib/cart-context";

type Review = {
  id: number;
  rating: number;
  title: string;
  comment: string;
  customerName: string;
  createdAt: string;
  verifiedPurchase: boolean;
};

type ReviewPayload = {
  reviews: Review[];
  summary: { averageRating: number; reviewCount: number };
  viewer: { signedIn: boolean; canReview: boolean; hasReviewed: boolean };
  error?: string;
};

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
    return `${product.campaignLabel} · Sınırlı koleksiyon avantajı`;
  }
  if (product.stock <= 3) {
    return `Koleksiyonluk son ${product.stock} parça`;
  }
  return "Seçkin koleksiyondan özel parça";
}

export default function ProductDetailClient({
  productId,
  showHeader = true,
}: {
  productId: number;
  showHeader?: boolean;
}) {
  const cart = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reviewData, setReviewData] = useState<ReviewPayload | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const fetchReviews = useCallback(async () => {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as ReviewPayload;
    if (!response.ok) throw new Error(payload.error || "Yorumlar alınamadı.");
    return payload;
  }, [productId]);

  const loadReviews = useCallback(async () => {
    setReviewData(await fetchReviews());
  }, [fetchReviews]);

  useEffect(() => {
    Promise.all([
      fetch("/api/store", { cache: "no-store" }).then(
        (response) => response.json() as Promise<{ products?: Product[] }>,
      ),
      fetchReviews(),
    ])
      .then(([store, reviews]) => {
        setReviewData(reviews);
        const selected = (store.products ?? []).find(
          (item) => item.id === productId,
        );
        if (!selected) {
          setNotFound(true);
          return;
        }
        setProduct(selected);
        try {
          const liked = JSON.parse(
            window.localStorage.getItem("terragolds-liked") ?? "[]",
          ) as unknown;
          setFavorite(
            Array.isArray(liked) && liked.map(Number).includes(productId),
          );
        } catch {
          setFavorite(false);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [fetchReviews, productId]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [productId]);

  const maximumQuantity = useMemo(
    () => Math.min(product?.stock ?? 1, 20),
    [product?.stock],
  );

  const toggleFavorite = () => {
    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    let liked: number[] = [];
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("terragolds-liked") ?? "[]",
      ) as unknown;
      liked = Array.isArray(stored)
        ? stored.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];
    } catch {
      liked = [];
    }
    const next = nextFavorite
      ? [...new Set([...liked, productId])]
      : liked.filter((id) => id !== productId);
    window.localStorage.setItem("terragolds-liked", JSON.stringify(next));
    window.dispatchEvent(new Event("terragolds-storage"));
    syncFavorites(next);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (cart.addToCart(product, quantity)) {
      setQuantity(1);
    }
  };

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReviewSubmitting(true);
    setReviewMessage("");
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Yorum gönderilemedi.");
      setReviewTitle("");
      setReviewComment("");
      setReviewMessage("Yorumunuz yayınlandı. Teşekkür ederiz.");
      await loadReviews();
    } catch (error) {
      setReviewMessage(
        error instanceof Error ? error.message : "Yorum gönderilemedi.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="product-profile-page">
        {showHeader && <StoreSubpageHeader />}
        <div className="product-profile-loading">Ürün hazırlanıyor…</div>
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="product-profile-page">
        {showHeader && <StoreSubpageHeader />}
        <div className="product-profile-loading">
          <h1>Ürün bulunamadı</h1>
          <Link href="/#shop">Alışverişe devam et</Link>
        </div>
      </main>
    );
  }

  const currentPrice = getDiscountedPrice(product);
  const productImages = [...new Set(
    [product.image, product.hoverImage].filter(
      (image): image is string => Boolean(image),
    ),
  )];
  const activeImage = productImages[selectedImageIndex] ?? product.image;
  const summary = reviewData?.summary ?? {
    averageRating: product.reviewAverage ?? 0,
    reviewCount: product.reviewCount ?? 0,
  };

  return (
    <main className="product-profile-page">
      {showHeader && <StoreSubpageHeader />}

      <div className="product-breadcrumb section-shell">
        <Link href="/">Ana Sayfa</Link>
        <span>/</span>
        <Link href="/#shop">Ürünler</Link>
        <span>/</span>
        <b>{product.name}</b>
      </div>

      <section className="product-profile section-shell">
        <div className="product-profile-gallery">
          <div className="product-profile-visual">
            {product.discountPercent > 0 && (
              <span className="profile-discount-badge">
                %{product.discountPercent} İNDİRİM
              </span>
            )}
            <button
              type="button"
              className={`profile-heart${favorite ? " liked" : ""}`}
              onClick={toggleFavorite}
              aria-label={
                favorite ? "Favorilerden çıkar" : "Favorilere ekle"
              }
            >
              {favorite ? "♥" : "♡"}
            </button>
            <button
              type="button"
              className="product-image-zoom-trigger"
              onClick={() => setImageZoomOpen(true)}
              aria-label={`${product.name} fotoğrafını büyüt`}
            >
              <img src={activeImage} alt={product.name} />
            </button>
          </div>

          {productImages.length > 1 && (
            <div className="product-gallery-thumbnails" aria-label="Ürün fotoğrafları">
              {productImages.map((image, index) => (
                <button
                  type="button"
                  className={index === selectedImageIndex ? "active" : ""}
                  key={image}
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={`${product.name}, ${index + 1}. fotoğrafı göster`}
                  aria-pressed={index === selectedImageIndex}
                >
                  <img src={image} alt="" />
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-profile-copy">
          <p className="profile-collection-label">{collectionMessage(product)}</p>
          <span className="product-profile-stone">{product.stone}</span>
          <h1>{product.name}</h1>

          <a className="product-rating-line" href="#yorumlar">
            <strong>
              {summary.reviewCount > 0
                ? summary.averageRating.toLocaleString("tr-TR")
                : "Yeni"}
            </strong>
            <span aria-hidden="true">
              {stars(Math.round(summary.averageRating || 0))}
            </span>
            <small>
              {summary.reviewCount > 0
                ? `${summary.reviewCount} doğrulanmış yorum`
                : "İlk yorumu siz yapın"}
            </small>
          </a>

          <div className="product-profile-price">
            {product.discountPercent > 0 && (
              <del>{money.format(product.price)}</del>
            )}
            <strong>{money.format(currentPrice)}</strong>
            <small>KDV dahil</small>
          </div>

          <p className="product-profile-description">{product.description}</p>

          <div className="product-assurances">
            <span>
              <b>Özenli paketleme</b>
              Taşın doğal yüzeyini koruyan güvenli gönderim
            </span>
            <span>
              <b>Doğrulanmış parça</b>
              Görsellerdeki doğal doku ve form karakteri
            </span>
          </div>

          <div className="product-authenticity-guarantee">
            <b>Orijinallik Garantisi</b>
            <p>
              Her ürünümüz, mağazamıza eklenmeden önce doğallık ve kalite
              açısından ekibimizce incelenir. Ürün açıklamasına uygun
              bulunmayan parçalarda{" "}
              <Link href="/teslimat-ve-iade">iade ve değişim politikamız</Link>{" "}
              kapsamında güvencedesiniz.
            </p>
          </div>

          <div className="product-profile-purchase">
            <div className="quantity-picker">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={quantity <= 1}
                aria-label="Adedi azalt"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={maximumQuantity}
                value={quantity}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setQuantity(
                    Math.min(
                      maximumQuantity,
                      Math.max(1, Math.round(Number(event.target.value)) || 1),
                    ),
                  )
                }
                aria-label="Ürün adedi"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) =>
                    Math.min(maximumQuantity, current + 1),
                  )
                }
                disabled={quantity >= maximumQuantity}
                aria-label="Adedi artır"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="profile-add-button"
              onClick={handleAddToCart}
              disabled={product.stock <= 0 || cart.addCooldownSeconds > 0}
            >
              {product.stock <= 0
                ? "Tükendi"
                : cart.addCooldownSeconds > 0
                  ? `${cart.addCooldownSeconds} sn bekleyin`
                  : "Sepete ekle"}
            </button>
          </div>
          <div className="product-purchase-meta">
            <span>
              {product.stock <= 3
                ? `Sınırlı stok · ${product.stock} adet`
                : "Stokta mevcut"}
            </span>
          </div>
        </div>
      </section>

      {imageZoomOpen && (
        <div
          className="overlay image-zoom-overlay"
          role="presentation"
          onMouseDown={() => setImageZoomOpen(false)}
        >
          <section
            className="image-zoom-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} büyük fotoğraf`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setImageZoomOpen(false)}
              aria-label="Kapat"
            >
              ×
            </button>
            <img src={activeImage} alt={product.name} />
            {productImages.length > 1 && (
              <div className="image-zoom-navigation">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIndex((current) =>
                      (current - 1 + productImages.length) % productImages.length
                    )
                  }
                  aria-label="Önceki fotoğraf"
                >
                  ←
                </button>
                <span>
                  {selectedImageIndex + 1} / {productImages.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageIndex((current) =>
                      (current + 1) % productImages.length
                    )
                  }
                  aria-label="Sonraki fotoğraf"
                >
                  →
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <section className="product-reviews section-shell" id="yorumlar">
        <div className="reviews-heading">
          <div>
            <p className="eyebrow">Doğrulanmış deneyimler</p>
            <h2>Müşteri yorumları</h2>
          </div>
          <div className="review-summary">
            <strong>
              {summary.reviewCount > 0
                ? summary.averageRating.toLocaleString("tr-TR")
                : "—"}
            </strong>
            <span>{stars(Math.round(summary.averageRating || 0))}</span>
            <small>{summary.reviewCount} yorum</small>
          </div>
        </div>

        <div className="reviews-layout">
          <div className="review-list">
            {reviewData?.reviews.length ? (
              reviewData.reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <header>
                    <div>
                      <strong>{review.customerName}</strong>
                      <span>Doğrulanmış alışveriş</span>
                    </div>
                    <time>
                      {new Date(review.createdAt).toLocaleDateString("tr-TR")}
                    </time>
                  </header>
                  <div className="review-stars" aria-label={`${review.rating} yıldız`}>
                    {stars(review.rating)}
                  </div>
                  {review.title && <h3>{review.title}</h3>}
                  <p>{review.comment}</p>
                </article>
              ))
            ) : (
              <div className="review-empty">
                <span>★★★★★</span>
                <h3>Henüz yorum yok</h3>
                <p>
                  Bu ürünü satın alan ilk üyelerden biriyseniz deneyiminizi
                  paylaşabilirsiniz.
                </p>
              </div>
            )}
          </div>

          <aside className="review-form-panel">
            <h3>Deneyiminizi paylaşın</h3>
            {!reviewData?.viewer.signedIn ? (
              <>
                <p>Yorum yazmak için hesabınıza giriş yapmanız gerekir.</p>
                <Link href="/login">Giriş yap</Link>
              </>
            ) : reviewData.viewer.hasReviewed ? (
              <p className="review-status">
                Bu ürün için yorum hakkınızı kullandınız. Her üye yalnızca bir
                yorum paylaşabilir.
              </p>
            ) : !reviewData.viewer.canReview ? (
              <p className="review-status">
                Yorumlar yalnızca bu ürünü satın almış üyeler tarafından
                yazılabilir.
              </p>
            ) : (
              <form onSubmit={submitReview}>
                <fieldset>
                  <legend>Puanınız</legend>
                  <div className="review-star-picker">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        type="button"
                        className={rating <= reviewRating ? "active" : ""}
                        key={rating}
                        onClick={() => setReviewRating(rating)}
                        aria-label={`${rating} yıldız`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Yorum başlığı <small>İsteğe bağlı</small>
                  <input
                    value={reviewTitle}
                    maxLength={80}
                    onChange={(event) => setReviewTitle(event.target.value)}
                    placeholder="Örneğin: Beklediğimden daha etkileyici"
                  />
                </label>
                <label>
                  Deneyiminiz
                  <textarea
                    value={reviewComment}
                    minLength={10}
                    maxLength={1000}
                    required
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Ürünün dokusu, rengi ve paketleme deneyimi hakkında düşüncelerinizi yazın."
                  />
                </label>
                <button type="submit" disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Gönderiliyor…" : "Yorumu yayınla"}
                </button>
              </form>
            )}
            {reviewMessage && <p className="review-message">{reviewMessage}</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
