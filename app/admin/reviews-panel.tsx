"use client";

import { useEffect, useState } from "react";

type Review = {
  id: number;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  productId: number;
  productName: string;
  firstName: string;
  lastName: string;
  email: string;
};

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  }
  return body;
}

export default function ReviewsPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/reviews", { cache: "no-store" }),
      );
      setReviews((body.reviews as Review[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Yorumlar alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReviews();
  }, []);

  const deleteReview = async (review: Review) => {
    if (!window.confirm(`"${review.title || review.comment.slice(0, 40)}" yorumu kaldırılsın mı?`)) {
      return;
    }
    setDeletingId(review.id);
    setError("");
    try {
      await readJson(
        await fetch(`/api/admin/reviews?id=${review.id}`, { method: "DELETE" }),
      );
      setReviews((current) => current.filter((item) => item.id !== review.id));
      onNotice("Yorum kaldırıldı.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Yorum silinemedi.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-discounts">
      <section className="admin-discount-hero">
        <div>
          <p className="admin-kicker">Yorum moderasyonu</p>
          <h2>Ürün yorumlarını inceleyin, uygunsuz olanları kaldırın.</h2>
          <p>
            Yorumlar yazıldığı anda vitrinde yayınlanır - burada sonradan
            inceleyip kaldırabilirsiniz.
          </p>
        </div>
      </section>

      {error && (
        <div className="admin-alert error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">
          <span />
          <p>Yorumlar hazırlanıyor…</p>
        </div>
      ) : reviews.length ? (
        <div className="admin-discount-list">
          {reviews.map((review) => (
            <article key={review.id}>
              <div className="admin-discount-code">
                <strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>
                <span className="discount-state">{review.productName}</span>
              </div>
              <div>
                <b>{review.title || "(başlıksız)"}</b>
                <small>{review.comment}</small>
              </div>
              <div>
                <b>
                  {review.firstName} {review.lastName}
                </b>
                <small>{review.email}</small>
              </div>
              <div className="admin-discount-actions">
                <button
                  className="danger"
                  type="button"
                  onClick={() => void deleteReview(review)}
                  disabled={deletingId === review.id}
                >
                  {deletingId === review.id ? "Kaldırılıyor…" : "Kaldır"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <span>★</span>
          <h2>Henüz yorum yok</h2>
          <p>Müşteriler ürün yorumu yazdığında burada görünecek.</p>
        </div>
      )}
    </div>
  );
}
