import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "İptal ve İade Koşulları | Terragolds",
  description: "Terragolds sipariş iptali, cayma hakkı ve iade koşulları.",
  alternates: {
    canonical: "https://www.terragolds.com/iptal-ve-iade-kosullari",
  },
};

export default function CancellationAndReturnsPage() {
  return <LegalDocumentPage document="deliveryReturns" />;
}
