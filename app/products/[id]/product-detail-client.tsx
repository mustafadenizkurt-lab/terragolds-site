"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StoreSubpageHeader from "../../store-subpage-header";
import SizeGuide from "./size-guide";
import CompareToggleButton from "../../compare-toggle-button";
import {
  getDiscountedPrice,
  type Product,
} from "../../../lib/store-data";
import { syncFavorites } from "../../../lib/favorite-client";
import { useCart } from "../../../lib/cart-context";
import { useLanguage } from "../../../lib/language-client";
import { uiUpper } from "../../../lib/i18n";

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

const copy = {
  tr: {
    preparing: "Ürün hazırlanıyor…",
    notFoundTitle: "Ürün bulunamadı",
    continueShopping: "Alışverişe devam et",
    home: "Ana Sayfa",
    products: "Ürünler",
    discount: (percent: number) => `%${percent} İndirim`,
    removeFavorite: "Favorilerden çıkar",
    addFavorite: "Favorilere ekle",
    zoomPhoto: (name: string) => `${name} fotoğrafını büyüt`,
    productPhotos: "Ürün fotoğrafları",
    showPhoto: (name: string, index: number) => `${name}, ${index}. fotoğrafı göster`,
    photoAlt: (name: string, index: number) => `${name} - görsel ${index}`,
    limitedCollectionOffer: "Sınırlı koleksiyon avantajı",
    lastPieces: (stock: number) => `Koleksiyonluk son ${stock} parça`,
    curatedPiece: "Seçkin koleksiyondan özel parça",
    ratingNew: "Yeni",
    verifiedReviewCount: (count: number) => `${count} doğrulanmış yorum`,
    beFirstToReview: "İlk yorumu siz yapın",
    vat: "+ KDV",
    carefulPackaging: "Özenli paketleme",
    carefulPackagingDetail: "Taşın doğal yüzeyini koruyan güvenli gönderim",
    verifiedPiece: "Doğrulanmış parça",
    verifiedPieceDetail: "Görsellerdeki doğal doku ve form karakteri",
    authenticityGuarantee: "Orijinallik Garantisi",
    authenticityGuaranteeTextBefore:
      "Her ürünümüz, mağazamıza eklenmeden önce doğallık ve kalite açısından ekibimizce incelenir. Ürün açıklamasına uygun bulunmayan parçalarda ",
    returnPolicyLink: "iade ve değişim politikamız",
    authenticityGuaranteeTextAfter: " kapsamında güvencedesiniz.",
    decreaseQuantity: "Adedi azalt",
    increaseQuantity: "Adedi artır",
    productQuantity: "Ürün adedi",
    outOfStock: "Tükendi",
    waitSeconds: (seconds: number) => `${seconds} sn bekleyin`,
    addToCart: "Sepete ekle",
    limitedStock: (stock: number) => `Sınırlı stok · ${stock} adet`,
    inStock: "Stokta mevcut",
    largePhoto: (name: string) => `${name} büyük fotoğraf`,
    close: "Kapat",
    previousPhoto: "Önceki fotoğraf",
    nextPhoto: "Sonraki fotoğraf",
    verifiedExperiences: "Doğrulanmış deneyimler",
    customerReviews: "Müşteri yorumları",
    reviewCount: (count: number) => `${count} yorum`,
    verifiedPurchase: "Doğrulanmış alışveriş",
    starsLabel: (rating: number) => `${rating} yıldız`,
    noReviewsYet: "Henüz yorum yok",
    noReviewsYetDetail:
      "Bu ürünü satın alan ilk üyelerden biriyseniz deneyiminizi paylaşabilirsiniz.",
    shareYourExperience: "Deneyiminizi paylaşın",
    loginToReview: "Yorum yazmak için hesabınıza giriş yapmanız gerekir.",
    login: "Giriş yap",
    alreadyReviewed:
      "Bu ürün için yorum hakkınızı kullandınız. Her üye yalnızca bir yorum paylaşabilir.",
    mustPurchaseToReview:
      "Yorumlar yalnızca bu ürünü satın almış üyeler tarafından yazılabilir.",
    yourRating: "Puanınız",
    reviewTitleLabel: "Yorum başlığı",
    optional: "İsteğe bağlı",
    reviewTitlePlaceholder: "Örneğin: Beklediğimden daha etkileyici",
    yourExperience: "Deneyiminiz",
    reviewCommentPlaceholder:
      "Ürünün dokusu, rengi ve paketleme deneyimi hakkında düşüncelerinizi yazın.",
    submitting: "Gönderiliyor…",
    publishReview: "Yorumu yayınla",
    reviewsFetchError: "Yorumlar alınamadı.",
    reviewSubmitError: "Yorum gönderilemedi.",
    reviewSubmitSuccess: "Yorumunuz yayınlandı. Teşekkür ederiz.",
    dateLocale: "tr-TR",
  },
  en: {
    preparing: "Preparing product…",
    notFoundTitle: "Product not found",
    continueShopping: "Continue shopping",
    home: "Home",
    products: "Products",
    discount: (percent: number) => `${percent}% Off`,
    removeFavorite: "Remove from favorites",
    addFavorite: "Add to favorites",
    zoomPhoto: (name: string) => `Zoom into ${name} photo`,
    productPhotos: "Product photos",
    showPhoto: (name: string, index: number) => `Show ${name}, photo ${index}`,
    photoAlt: (name: string, index: number) => `${name} - image ${index}`,
    limitedCollectionOffer: "Limited collection advantage",
    lastPieces: (stock: number) => `Only ${stock} pieces left`,
    curatedPiece: "A special piece from a curated collection",
    ratingNew: "New",
    verifiedReviewCount: (count: number) => `${count} verified reviews`,
    beFirstToReview: "Be the first to review",
    vat: "+ VAT",
    carefulPackaging: "Careful packaging",
    carefulPackagingDetail: "Secure delivery that protects the stone's natural surface",
    verifiedPiece: "Verified piece",
    verifiedPieceDetail: "Natural texture and form shown in the photos",
    authenticityGuarantee: "Authenticity Guarantee",
    authenticityGuaranteeTextBefore:
      "Every product is inspected by our team for authenticity and quality before it's listed. If a piece doesn't match its description, you're covered under our ",
    returnPolicyLink: "return and exchange policy",
    authenticityGuaranteeTextAfter: ".",
    decreaseQuantity: "Decrease quantity",
    increaseQuantity: "Increase quantity",
    productQuantity: "Product quantity",
    outOfStock: "Sold out",
    waitSeconds: (seconds: number) => `Wait ${seconds}s`,
    addToCart: "Add to cart",
    limitedStock: (stock: number) => `Limited stock · ${stock} left`,
    inStock: "In stock",
    largePhoto: (name: string) => `${name} large photo`,
    close: "Close",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    verifiedExperiences: "Verified experiences",
    customerReviews: "Customer reviews",
    reviewCount: (count: number) => `${count} reviews`,
    verifiedPurchase: "Verified purchase",
    starsLabel: (rating: number) => `${rating} stars`,
    noReviewsYet: "No reviews yet",
    noReviewsYetDetail:
      "If you're one of the first to buy this product, share your experience.",
    shareYourExperience: "Share your experience",
    loginToReview: "You need to sign in to your account to leave a review.",
    login: "Sign in",
    alreadyReviewed:
      "You've already used your review for this product. Each member can share one review.",
    mustPurchaseToReview: "Only members who purchased this product can leave a review.",
    yourRating: "Your rating",
    reviewTitleLabel: "Review title",
    optional: "Optional",
    reviewTitlePlaceholder: "E.g.: More impressive than I expected",
    yourExperience: "Your experience",
    reviewCommentPlaceholder:
      "Share your thoughts on the product's texture, color and packaging experience.",
    submitting: "Submitting…",
    publishReview: "Publish review",
    reviewsFetchError: "Could not load reviews.",
    reviewSubmitError: "Could not submit review.",
    reviewSubmitSuccess: "Your review has been published. Thank you.",
    dateLocale: "en-US",
  },
} as const;

function stars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating);
}

export default function ProductDetailClient({
  productId,
  showHeader = true,
}: {
  productId: number;
  showHeader?: boolean;
}) {
  const cart = useCart();
  const [language] = useLanguage();
  const t = copy[language];
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

  const collectionMessage = useCallback(
    (item: Product) => {
      if (item.campaignLabel) {
        return `${item.campaignLabel} · ${t.limitedCollectionOffer}`;
      }
      if (item.stock <= 3) {
        return t.lastPieces(item.stock);
      }
      return t.curatedPiece;
    },
    [t],
  );

  const fetchReviews = useCallback(async () => {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as ReviewPayload;
    if (!response.ok) throw new Error(payload.error || t.reviewsFetchError);
    return payload;
  }, [productId, t]);

  const loadReviews = useCallback(async () => {
    setReviewData(await fetchReviews());
  }, [fetchReviews]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${productId}`, { cache: "no-store" }).then(
        (response) => response.json() as Promise<{ product?: Product }>,
      ),
      fetchReviews(),
    ])
      .then(([{ product: selected }, reviews]) => {
        setReviewData(reviews);
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
      if (!response.ok) throw new Error(payload.error || t.reviewSubmitError);
      setReviewTitle("");
      setReviewComment("");
      setReviewMessage(t.reviewSubmitSuccess);
      await loadReviews();
    } catch (error) {
      setReviewMessage(
        error instanceof Error ? error.message : t.reviewSubmitError,
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="product-profile-page">
        {showHeader && <StoreSubpageHeader />}
        <div className="product-profile-loading">{t.preparing}</div>
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="product-profile-page">
        {showHeader && <StoreSubpageHeader />}
        <div className="product-profile-loading">
          <h1>{t.notFoundTitle}</h1>
          <Link href="/#shop">{t.continueShopping}</Link>
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
        <Link href="/">{t.home}</Link>
        <span>/</span>
        <Link href="/#shop">{t.products}</Link>
        <span>/</span>
        <b>{product.name}</b>
      </div>

      <section className="product-profile section-shell">
        <div className="product-profile-gallery">
          <div className="product-profile-visual">
            {product.discountPercent > 0 && (
              <span className="profile-discount-badge">
                {uiUpper(t.discount(product.discountPercent), language)}
              </span>
            )}
            <button
              type="button"
              className={`profile-heart${favorite ? " liked" : ""}`}
              onClick={toggleFavorite}
              aria-label={favorite ? t.removeFavorite : t.addFavorite}
            >
              {favorite ? "♥" : "♡"}
            </button>
            <button
              type="button"
              className="product-image-zoom-trigger"
              onClick={() => setImageZoomOpen(true)}
              aria-label={t.zoomPhoto(product.name)}
            >
              <img src={activeImage} alt={product.name} />
            </button>
          </div>

          {productImages.length > 1 && (
            <div className="product-gallery-thumbnails" aria-label={t.productPhotos}>
              {productImages.map((image, index) => (
                <button
                  type="button"
                  className={index === selectedImageIndex ? "active" : ""}
                  key={image}
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={t.showPhoto(product.name, index + 1)}
                  aria-pressed={index === selectedImageIndex}
                >
                  <img src={image} alt={t.photoAlt(product.name, index + 1)} />
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
          {product.xmlExternalId && (
            <span className="product-profile-code">#{product.xmlExternalId}</span>
          )}

          <a className="product-rating-line" href="#yorumlar">
            <strong>
              {summary.reviewCount > 0
                ? summary.averageRating.toLocaleString(t.dateLocale)
                : t.ratingNew}
            </strong>
            <span aria-hidden="true">
              {stars(Math.round(summary.averageRating || 0))}
            </span>
            <small>
              {summary.reviewCount > 0
                ? t.verifiedReviewCount(summary.reviewCount)
                : t.beFirstToReview}
            </small>
          </a>

          <div className="product-profile-price">
            {product.discountPercent > 0 && (
              <del>{money.format(product.price)}</del>
            )}
            <strong>{money.format(currentPrice)}</strong>
            <small>{t.vat}</small>
          </div>

          <p className="product-profile-description">{product.description}</p>

          <SizeGuide category={product.category} productName={product.name} />

          <CompareToggleButton productId={product.id} productName={product.name} />

          <div className="product-assurances">
            <span>
              <b>{t.carefulPackaging}</b>
              {t.carefulPackagingDetail}
            </span>
            <span>
              <b>{t.verifiedPiece}</b>
              {t.verifiedPieceDetail}
            </span>
          </div>

          <div className="product-authenticity-guarantee">
            <b>{t.authenticityGuarantee}</b>
            <p>
              {t.authenticityGuaranteeTextBefore}
              <Link href="/teslimat-ve-iade">{t.returnPolicyLink}</Link>
              {t.authenticityGuaranteeTextAfter}
            </p>
          </div>

          <div className="product-profile-purchase">
            <div className="quantity-picker">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={quantity <= 1}
                aria-label={t.decreaseQuantity}
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
                aria-label={t.productQuantity}
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) =>
                    Math.min(maximumQuantity, current + 1),
                  )
                }
                disabled={quantity >= maximumQuantity}
                aria-label={t.increaseQuantity}
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
                ? t.outOfStock
                : cart.addCooldownSeconds > 0
                  ? t.waitSeconds(cart.addCooldownSeconds)
                  : t.addToCart}
            </button>
          </div>
          <div className="product-purchase-meta">
            <span>
              {product.stock <= 3 ? t.limitedStock(product.stock) : t.inStock}
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
            aria-label={t.largePhoto(product.name)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setImageZoomOpen(false)}
              aria-label={t.close}
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
                  aria-label={t.previousPhoto}
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
                  aria-label={t.nextPhoto}
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
            <p className="eyebrow">{t.verifiedExperiences}</p>
            <h2>{t.customerReviews}</h2>
          </div>
          <div className="review-summary">
            <strong>
              {summary.reviewCount > 0
                ? summary.averageRating.toLocaleString(t.dateLocale)
                : "—"}
            </strong>
            <span>{stars(Math.round(summary.averageRating || 0))}</span>
            <small>{t.reviewCount(summary.reviewCount)}</small>
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
                      <span>{t.verifiedPurchase}</span>
                    </div>
                    <time>
                      {new Date(review.createdAt).toLocaleDateString(t.dateLocale)}
                    </time>
                  </header>
                  <div className="review-stars" aria-label={t.starsLabel(review.rating)}>
                    {stars(review.rating)}
                  </div>
                  {review.title && <h3>{review.title}</h3>}
                  <p>{review.comment}</p>
                </article>
              ))
            ) : (
              <div className="review-empty">
                <span>★★★★★</span>
                <h3>{t.noReviewsYet}</h3>
                <p>{t.noReviewsYetDetail}</p>
              </div>
            )}
          </div>

          <aside className="review-form-panel">
            <h3>{t.shareYourExperience}</h3>
            {!reviewData?.viewer.signedIn ? (
              <>
                <p>{t.loginToReview}</p>
                <Link href="/login">{t.login}</Link>
              </>
            ) : reviewData.viewer.hasReviewed ? (
              <p className="review-status">{t.alreadyReviewed}</p>
            ) : !reviewData.viewer.canReview ? (
              <p className="review-status">{t.mustPurchaseToReview}</p>
            ) : (
              <form onSubmit={submitReview}>
                <fieldset>
                  <legend>{t.yourRating}</legend>
                  <div className="review-star-picker">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        type="button"
                        className={rating <= reviewRating ? "active" : ""}
                        key={rating}
                        onClick={() => setReviewRating(rating)}
                        aria-label={t.starsLabel(rating)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  {t.reviewTitleLabel} <small>{t.optional}</small>
                  <input
                    value={reviewTitle}
                    maxLength={80}
                    onChange={(event) => setReviewTitle(event.target.value)}
                    placeholder={t.reviewTitlePlaceholder}
                  />
                </label>
                <label>
                  {t.yourExperience}
                  <textarea
                    value={reviewComment}
                    minLength={10}
                    maxLength={1000}
                    required
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder={t.reviewCommentPlaceholder}
                  />
                </label>
                <button type="submit" disabled={reviewSubmitting}>
                  {reviewSubmitting ? t.submitting : t.publishReview}
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
