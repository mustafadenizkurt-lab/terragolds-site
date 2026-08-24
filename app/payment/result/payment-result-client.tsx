"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "../../../lib/cart-context";

export default function PaymentResultClient({
  status,
  orderId,
}: {
  status: "success" | "failed" | "pending";
  orderId: string;
}) {
  const cart = useCart();

  useEffect(() => {
    if (status !== "success") return;
    cart.clearCart();
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
        "Bilgilerinizi kontrol ederek yeniden deneyebilir veya farklı bir ödeme yöntemi seçebilirsiniz.",
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
          <Link className="button button-dark" href="/orders">
            Siparişlerimi görüntüle
          </Link>
          <Link href="/#shop">Alışverişe devam et</Link>
        </div>
      </section>
    </main>
  );
}
