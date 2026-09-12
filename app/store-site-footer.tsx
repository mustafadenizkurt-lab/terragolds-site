"use client";

import Link from "next/link";
import { Mail, MessageCircle, Phone, ShieldCheck, Star } from "lucide-react";
import { useLanguage } from "../lib/language-client";

const GOOGLE_REVIEW_URL = "https://g.page/r/CULplaYbZk3XECE/review";

const legalLinks = [
  { href: "/kvkk", tr: "KVKK Aydınlatma Metni", en: "Privacy Notice (KVKK)" },
  { href: "/gizlilik-politikasi", tr: "Gizlilik Politikası", en: "Privacy Policy" },
  { href: "/cerez-politikasi", tr: "Çerez Politikası", en: "Cookie Policy" },
  { href: "/mesafeli-satis-sozlesmesi", tr: "Mesafeli Satış Sözleşmesi", en: "Distance Sales Agreement" },
  { href: "/on-bilgilendirme-formu", tr: "Ön Bilgilendirme Formu", en: "Pre-Information Form" },
  { href: "/teslimat-ve-iade", tr: "Teslimat ve İade", en: "Shipping & Returns" },
  { href: "/kullanim-kosullari", tr: "Kullanım Koşulları", en: "Terms of Use" },
  { href: "/guvenli-alisveris", tr: "Güvenli Alışveriş", en: "Secure Shopping" },
] as const;

const paymentBadges = ["Visa", "Mastercard", "Troy", "Maestro"] as const;

const copy = {
  tr: {
    tagline:
      "Şıklığın yeni adresi. Özenle seçilmiş takı ve aksesuar koleksiyonları.",
    discover: "Keşfet",
    products: "Ürünler",
    compare: "Ürün Karşılaştır",
    corporate: "Kurumsal",
    about: "Hakkımızda",
    blog: "Blog",
    contact: "İletişim",
    orderTracking: "Sipariş Takibi",
    support: "Müşteri Hizmetleri",
    delivery: "Teslimat ve İade",
    faq: "Sıkça Sorulan Sorular",
    preInfo: "Ön Bilgilendirme",
    distanceSales: "Mesafeli Satış",
    secureShopping: "Güvenli Alışveriş",
    legal: "Yasal",
    terms: "Kullanım Koşulları",
    copyright: "Tüm hakları saklıdır.",
    supportCenter: "Destek Merkezi",
    callCenter: "Çağrı Merkezi",
    whatsappSupport: "WhatsApp Destek",
    support247: "7/24 Destek",
    socialMedia: "Sosyal Medya",
    googleReview: "Bizi Değerlendirin",
    securePayment: "Güvenli Ödeme",
    sslSecure: "SSL Güvenli",
  },
  en: {
    tagline:
      "Curated jewelry and accessory collections delivered across Türkiye.",
    discover: "Discover",
    products: "Products",
    compare: "Compare Products",
    corporate: "Company",
    about: "About Us",
    blog: "Blog",
    contact: "Contact",
    orderTracking: "Track Order",
    support: "Customer Service",
    delivery: "Shipping & Returns",
    faq: "FAQ",
    preInfo: "Pre-Information",
    distanceSales: "Distance Sales",
    secureShopping: "Secure Shopping",
    legal: "Legal",
    terms: "Terms of Use",
    copyright: "All rights reserved.",
    supportCenter: "Support Center",
    callCenter: "Call Center",
    whatsappSupport: "WhatsApp Support",
    support247: "24/7 Support",
    socialMedia: "Social Media",
    googleReview: "Rate Us on Google",
    securePayment: "Secure Payment",
    sslSecure: "SSL Secure",
  },
} as const;

export default function StoreSiteFooter({
  lang,
  description,
  footerNote,
  businessName,
  address,
  phone,
  whatsapp,
  email,
  instagram,
  facebook,
  tiktok,
}: {
  lang?: "tr" | "en";
  description?: string;
  footerNote?: string;
  businessName?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}) {
  const [detectedLanguage] = useLanguage();
  // Callers that already track their own language (the homepage) pass it
  // explicitly; every other page has no language state of its own, so the
  // footer detects it itself from the shared "terragolds-language" key
  // (see lib/language-client.ts) instead of always defaulting to Turkish.
  const resolvedLanguage = lang ?? detectedLanguage;
  const t = copy[resolvedLanguage];
  const hasSupportInfo = Boolean(phone || whatsapp || email);
  const hasSocialLinks = Boolean(instagram || facebook || tiktok);

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
          <Link href="/karsilastir">{t.compare}</Link>
        </nav>
        <nav aria-label={t.corporate}>
          <strong>{t.corporate}</strong>
          <Link href="/hakkimizda">{t.about}</Link>
          <Link href="/blog">{t.blog}</Link>
          <Link href="/support">{t.contact}</Link>
          <Link href="/orders">{t.orderTracking}</Link>
        </nav>
        <nav aria-label={t.support}>
          <strong>{t.support}</strong>
          <Link href="/sss">{t.faq}</Link>
          <Link href="/teslimat-ve-iade">{t.delivery}</Link>
          <Link href="/on-bilgilendirme-formu">{t.preInfo}</Link>
          <Link href="/mesafeli-satis-sozlesmesi">{t.distanceSales}</Link>
          <Link href="/guvenli-alisveris">{t.secureShopping}</Link>
        </nav>
        <nav aria-label={t.legal}>
          <strong>{t.legal}</strong>
          {legalLinks.slice(0, 3).map((link) => (
            <Link href={link.href} key={link.href}>
              {resolvedLanguage === "en" ? link.en : link.tr}
            </Link>
          ))}
          <Link href="/kullanim-kosullari">{t.terms}</Link>
        </nav>
      </div>

      <div className="store-site-footer-extra">
        {hasSupportInfo && (
          <div className="store-site-footer-support">
            <strong>{t.supportCenter}</strong>
            {phone && (
              <a
                className="store-site-footer-support-row"
                href={`tel:${phone.replace(/\s+/g, "")}`}
              >
                <Phone aria-hidden="true" size={18} strokeWidth={1.75} />
                <span>
                  <small>{t.callCenter}</small>
                  <b>{phone}</b>
                </span>
              </a>
            )}
            {whatsapp && (
              <a
                className="store-site-footer-support-row"
                href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle
                  aria-hidden="true"
                  size={18}
                  strokeWidth={1.75}
                />
                <span>
                  <small>{t.whatsappSupport}</small>
                  <b>{whatsapp}</b>
                </span>
              </a>
            )}
            {email && (
              <a
                className="store-site-footer-support-row"
                href={`mailto:${email}`}
              >
                <Mail aria-hidden="true" size={18} strokeWidth={1.75} />
                <span>
                  <small>{t.support247}</small>
                  <b>{email}</b>
                </span>
              </a>
            )}
          </div>
        )}
        <div className="store-site-footer-side">
          <div className="store-site-footer-social">
            <strong>{t.socialMedia}</strong>
            {hasSocialLinks && (
              <div className="store-site-footer-social-row">
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                  >
                    <img
                      src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/instagram.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </a>
                )}
                {facebook && (
                  <a
                    href={facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                  >
                    <img
                      src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/facebook.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </a>
                )}
                {tiktok && (
                  <a
                    href={tiktok}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="TikTok"
                  >
                    <img
                      src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/tiktok.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </a>
                )}
              </div>
            )}
            <a
              className="store-site-footer-google-review"
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noreferrer"
            >
              <Star
                aria-hidden="true"
                size={13}
                strokeWidth={2}
                fill="currentColor"
              />
              {t.googleReview}
            </a>
          </div>
          <div className="store-site-footer-payments">
            <strong>{t.securePayment}</strong>
            <div className="store-site-footer-payments-row">
              {paymentBadges.map((label) => (
                <span className="store-site-footer-payment-badge" key={label}>
                  {label}
                </span>
              ))}
              <span className="store-site-footer-payment-badge ssl">
                <ShieldCheck aria-hidden="true" size={13} strokeWidth={2} />
                {t.sslSecure}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="store-site-footer-legal">
        <span>
          {businessName ? `© 2026 ${businessName}. ` : "© 2026 Terragolds. "}
          {t.copyright}
          {footerNote ? ` · ${footerNote}` : ""}
        </span>
        <nav aria-label={resolvedLanguage === "en" ? "Agreements" : "Sözleşmeler"}>
          {legalLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {resolvedLanguage === "en" ? link.en : link.tr}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
