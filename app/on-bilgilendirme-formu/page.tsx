import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu | Terragolds",
  description:
    "Terragolds ön bilgilendirme formu: satın alma öncesi ürün, fiyat, teslimat ve cayma hakkı bilgilendirmesi.",
  alternates: {
    canonical: "https://www.terragolds.com/on-bilgilendirme-formu",
  },
};
export default function Page() { return <LegalDocumentPage document="preInformation" />; }
