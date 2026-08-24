import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "İptal ve İade Koşulları | Terragolds",
  description: "Terragolds sipariş iptali, cayma hakkı ve iade koşulları.",
};

export default function CancellationAndReturnsPage() {
  return <LegalDocumentPage document="deliveryReturns" />;
}
