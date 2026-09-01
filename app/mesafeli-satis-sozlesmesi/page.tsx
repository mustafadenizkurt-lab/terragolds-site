import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi | Terragolds",
  description:
    "Terragolds mesafeli satış sözleşmesi: sipariş, teslimat ve cayma hakkına dair yasal koşullar.",
  alternates: {
    canonical: "https://www.terragolds.com/mesafeli-satis-sozlesmesi",
  },
};
export default function Page() { return <LegalDocumentPage document="distanceSales" />; }
