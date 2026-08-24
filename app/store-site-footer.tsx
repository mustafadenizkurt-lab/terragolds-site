import Link from "next/link";

const legalLinks = [
  ["KVKK Aydınlatma Metni", "/kvkk"],
  ["Gizlilik Politikası", "/gizlilik-politikasi"],
  ["Çerez Politikası", "/cerez-politikasi"],
  ["Mesafeli Satış Sözleşmesi", "/mesafeli-satis-sozlesmesi"],
  ["Ön Bilgilendirme Formu", "/on-bilgilendirme-formu"],
  ["Teslimat ve İade", "/teslimat-ve-iade"],
  ["Kullanım Koşulları", "/kullanim-kosullari"],
  ["Güvenli Alışveriş", "/guvenli-alisveris"],
] as const;

const copy = {
  tr: {
    tagline:
      "Doğanın zamansız parçaları. Özenle seçilmiş doğal taş ürünleri.",
    discover: "Keşfet",
    products: "Ürünler",
    corporate: "Kurumsal",
    about: "Hakkımızda",
    contact: "İletişim",
    orderTracking: "Sipariş Takibi",
    support: "Müşteri Hizmetleri",
    delivery: "Teslimat ve İade",
    preInfo: "Ön Bilgilendirme",
    distanceSales: "Mesafeli Satış",
    secureShopping: "Güvenli Alışveriş",
    legal: "Yasal",
    terms: "Kullanım Koşulları",
    copyright: "© 2026 Terragolds. Tüm hakları saklıdır.",
  },
  en: {
    tagline:
      "Curated natural stones, crystals and decorative pieces delivered across Türkiye.",
    discover: "Discover",
    products: "Products",
    corporate: "Company",
    about: "About Us",
    contact: "Contact",
    orderTracking: "Track Order",
    support: "Customer Service",
    delivery: "Shipping & Returns",
    preInfo: "Pre-Information",
    distanceSales: "Distance Sales",
    secureShopping: "Secure Shopping",
    legal: "Legal",
    terms: "Terms of Use",
    copyright: "© 2026 Terragolds. All rights reserved.",
  },
} as const;

export default function StoreSiteFooter({
  lang = "tr",
  description,
  footerNote,
  businessName,
  address,
}: {
  lang?: "tr" | "en";
  description?: string;
  footerNote?: string;
  businessName?: string;
  address?: string;
}) {
  const t = copy[lang];
  return (
    <footer className="store-site-footer">
      <div className="store-site-footer-main">
        <div>
          <Link className="store-site-footer-brand" href="/">
            TERRA<strong>GOLDS</strong>
          </Link>
          <p>{description || t.tagline}</p>
          {address && (
            <address className="store-site-footer-address">
              {businessName || "Terragolds"}
              <br />
              {address}
            </address>
          )}
        </div>
        <nav aria-label={t.discover}>
          <strong>{t.discover}</strong>
          <Link href="/#shop">{t.products}</Link>
        </nav>
        <nav aria-label={t.corporate}>
          <strong>{t.corporate}</strong>
          <Link href="/hakkimizda">{t.about}</Link>
          <Link href="/support">{t.contact}</Link>
          <Link href="/orders">{t.orderTracking}</Link>
        </nav>
        <nav aria-label={t.support}>
          <strong>{t.support}</strong>
          <Link href="/teslimat-ve-iade">{t.delivery}</Link>
          <Link href="/on-bilgilendirme-formu">{t.preInfo}</Link>
          <Link href="/mesafeli-satis-sozlesmesi">{t.distanceSales}</Link>
          <Link href="/guvenli-alisveris">{t.secureShopping}</Link>
        </nav>
        <nav aria-label={t.legal}>
          <strong>{t.legal}</strong>
          {legalLinks.slice(0, 3).map(([label, href]) => (
            <Link href={href} key={href}>{label}</Link>
          ))}
          <Link href="/kullanim-kosullari">{t.terms}</Link>
        </nav>
      </div>
      <div className="store-site-footer-legal">
        <span>
          {t.copyright}
          {footerNote ? ` · ${footerNote}` : ""}
        </span>
        <nav aria-label="Sözleşmeler">
          {legalLinks.map(([label, href]) => (
            <Link href={href} key={href}>{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
