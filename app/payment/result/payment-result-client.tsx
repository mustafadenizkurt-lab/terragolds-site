"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "../../../lib/cart-context";
import { trackPurchase } from "../../../lib/analytics";

export default function PaymentResultClient({
  status,
  orderId,
  orderAmount,
  whatsapp,
}: {
  status: "success" | "failed" | "pending";
  orderId: string;
  orderAmount: number | null;
  whatsapp: string;
}) {
  const cart = useCart();

  useEffect(() => {
    if (status !== "success") return;
    cart.clearCart();
    if (orderId && orderAmount !== null) {
      trackPurchase({ id: orderId, value: orderAmount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const content = {
    success: {
      eyebrow: "Ödeme tamamlandı",
      title: "Siparişiniz güvenle alındı.",
      detail:
        "Ödemeniz doğrulandı. Siparişinizin durumunu hesabınızdaki Siparişlerim bölümünden takip edebilirsiniz.",
      icon: "✓",
    },
    pending: {
      eyebrow: "Ödeme kontrol ediliyor",
      title: "Sonuç sağlayıcıdan bekleniyor.",
      detail:
        "Ödeme bildirimi kısa süre içinde işlenecek. Sayfayı yenilemek yerine Siparişlerim bölümünden durumu kontrol edebilirsiniz.",
      icon: "…",
    },
    failed: {
      eyebrow: "Ödeme tamamlanamadı",
      title: "Siparişiniz için tahsilat alınmadı.",
      detail:
        "Kart bilgilerinizi kontrol ederek yeniden deneyebilir veya farklı bir ödeme yöntemi seçebilirsiniz. Sepetiniz korunuyor, ürünler kaybolmadı.",
      icon: "!",
    },
  }[status];

  return (
    <main className="payment-page-shell">
      <section className={`payment-result-card ${status}`}>
        <span className="payment-result-icon">{content.icon}</span>
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.detail}</p>
        {orderId && <small>Sipariş numarası: {orderId}</small>}
        <div>
          {status === "failed" ? (
            <button
              type="button"
              className="button button-dark"
              onClick={() => cart.openCart()}
            >
              Tekrar dene
            </button>
          ) : (
            <Link className="button button-dark" href="/orders">
              Siparişlerimi görüntüle
            </Link>
          )}
          <Link href="/#shop">Alışverişe devam et</Link>
        </div>
        {status === "failed" && whatsapp && (
          <p className="payment-result-help">
            Sorun devam ederse{" "}
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp&apos;tan bize yazın
            </a>
            .
          </p>
        )}
      </section>
    </main>
  );
}
