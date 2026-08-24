import type { Metadata } from "next";
import Link from "next/link";
import PaytrFrame from "./paytr-frame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Güvenli Ödeme | Terragolds",
  robots: { index: false, follow: false },
};

export default async function PaytrPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; orderId?: string }>;
}) {
  const { token = "", orderId = "" } = await searchParams;
  const validToken = /^[A-Za-z0-9_-]{10,300}$/.test(token);
  if (!validToken) {
    return (
      <main className="payment-page-shell">
        <section className="payment-result-card failed">
          <span className="payment-result-icon">!</span>
          <p className="eyebrow">Güvenli ödeme</p>
          <h1>Ödeme oturumu bulunamadı.</h1>
          <p>Sepetinize dönerek ödeme işlemini yeniden başlatabilirsiniz.</p>
          <Link href="/#shop">Alışverişe dön</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="paytr-payment-page">
      <header>
        <Link href="/" aria-label="Terragolds ana sayfa">
          TERRA<strong>GOLDS</strong>
        </Link>
        <div>
          <span>Güvenli ödeme</span>
          {orderId && <small>Sipariş: {orderId}</small>}
        </div>
      </header>
      <PaytrFrame token={token} />
      <p>
        Kart bilgileriniz Terragolds tarafından görülmez veya saklanmaz. Ödeme
        alanı PayTR tarafından güvenli şekilde sunulur.
      </p>
    </main>
  );
}
