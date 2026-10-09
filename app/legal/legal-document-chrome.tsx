"use client";

import Link from "next/link";
import type { LegalDocumentContent } from "../../lib/site-content-types";
import { useLanguage } from "../../lib/language-client";

// The document's own title/eyebrow/summary/updated-date and its section
// paragraphs are admin-authored legal content (see lib/site-content-types.ts)
// - same unreviewed-draft content flagged separately, so they stay exactly
// as authored regardless of language. Only the surrounding chrome (labels,
// breadcrumb, sidebar nav, seller-info-card field names) is translated here.
const copy = {
  tr: {
    home: "Ana Sayfa",
    sidebarTitle: "Yasal Belgeler",
    secureShopping: "Güvenli Alışveriş",
    kvkk: "KVKK",
    privacy: "Gizlilik",
    cookies: "Çerezler",
    distanceSales: "Mesafeli Satış",
    preInformation: "Ön Bilgilendirme",
    deliveryReturns: "Teslimat ve İade",
    terms: "Kullanım Koşulları",
    lastUpdated: "Son güncelleme:",
    sellerCardTitle: "Satıcı / veri sorumlusu iletişim bilgileri",
    business: "İşletme",
    legalName: "Ticari unvan",
    address: "İletişim adresi",
    legalAddress: "Kayıtlı (ticaret sicili) adresi",
    taxInfo: "Vergi dairesi / no",
    mersisNo: "MERSİS no",
    returnCarrier: "İade kargo firması",
    returnAddress: "İade adresi",
    phone: "Telefon",
    email: "E-posta",
    fillFromAdmin: "Yönetim panelinden eklenmelidir.",
  },
  en: {
    home: "Home",
    sidebarTitle: "Legal Documents",
    secureShopping: "Secure Shopping",
    kvkk: "Privacy Notice (KVKK)",
    privacy: "Privacy Policy",
    cookies: "Cookies",
    distanceSales: "Distance Sales",
    preInformation: "Pre-Information",
    deliveryReturns: "Shipping & Returns",
    terms: "Terms of Use",
    lastUpdated: "Last updated:",
    sellerCardTitle: "Seller / data controller contact details",
    business: "Business",
    legalName: "Legal (trade) name",
    address: "Contact address",
    legalAddress: "Registered (trade registry) address",
    taxInfo: "Tax office / number",
    mersisNo: "MERSİS no",
    returnCarrier: "Return shipping carrier",
    returnAddress: "Return address",
    phone: "Phone",
    email: "Email",
    fillFromAdmin: "Must be added from the admin panel.",
  },
} as const;

export function LegalHero({ content }: { content: LegalDocumentContent }) {
  const [language] = useLanguage();
  const t = copy[language];
  return (
    <section className="legal-hero">
      <div className="legal-breadcrumb">
        <Link href="/">{t.home}</Link>
        <span>/</span>
        <b>{content.title}</b>
      </div>
      <p>{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <span>{content.summary}</span>
      <small>{t.lastUpdated} {content.updated}</small>
    </section>
  );
}

export function LegalSidebar() {
  const [language] = useLanguage();
  const t = copy[language];
  return (
    <aside>
      <strong>{t.sidebarTitle}</strong>
      <Link href="/guvenli-alisveris">{t.secureShopping}</Link>
      <Link href="/kvkk">{t.kvkk}</Link>
      <Link href="/gizlilik-politikasi">{t.privacy}</Link>
      <Link href="/cerez-politikasi">{t.cookies}</Link>
      <Link href="/mesafeli-satis-sozlesmesi">{t.distanceSales}</Link>
      <Link href="/on-bilgilendirme-formu">{t.preInformation}</Link>
      <Link href="/teslimat-ve-iade">{t.deliveryReturns}</Link>
      <Link href="/kullanim-kosullari">{t.terms}</Link>
    </aside>
  );
}

export function LegalSellerCard({
  businessName,
  legalName,
  address,
  legalAddress,
  taxOffice,
  taxId,
  mersisNo,
  returnCarrier,
  returnAddress,
  phone,
  email,
}: {
  businessName?: string;
  legalName?: string;
  address?: string;
  legalAddress?: string;
  taxOffice?: string;
  taxId?: string;
  mersisNo?: string;
  returnCarrier?: string;
  returnAddress?: string;
  phone?: string;
  email?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const taxInfo = [taxOffice, taxId].filter(Boolean).join(" / ");
  return (
    <section className="legal-seller-card">
      <span>—</span>
      <div>
        <h2>{t.sellerCardTitle}</h2>
        <dl>
          <div><dt>{t.business}</dt><dd>{businessName || "Terragolds"}</dd></div>
          {legalName && <div><dt>{t.legalName}</dt><dd>{legalName}</dd></div>}
          {legalAddress && <div><dt>{t.legalAddress}</dt><dd>{legalAddress}</dd></div>}
          <div><dt>{t.address}</dt><dd>{address || t.fillFromAdmin}</dd></div>
          {taxInfo && <div><dt>{t.taxInfo}</dt><dd>{taxInfo}</dd></div>}
          {mersisNo && <div><dt>{t.mersisNo}</dt><dd>{mersisNo}</dd></div>}
          {returnCarrier && <div><dt>{t.returnCarrier}</dt><dd>{returnCarrier}</dd></div>}
          {returnAddress && <div><dt>{t.returnAddress}</dt><dd>{returnAddress}</dd></div>}
          <div><dt>{t.phone}</dt><dd>{phone || t.fillFromAdmin}</dd></div>
          <div><dt>{t.email}</dt><dd>{email || t.fillFromAdmin}</dd></div>
        </dl>
      </div>
    </section>
  );
}
