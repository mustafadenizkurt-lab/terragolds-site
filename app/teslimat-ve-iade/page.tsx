import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Teslimat, İptal ve İade | Terragolds",
  description:
    "Terragolds teslimat süreleri, kargo bilgileri, iptal ve iade koşulları hakkında detaylı bilgi.",
  alternates: { canonical: "https://www.terragolds.com/teslimat-ve-iade" },
};
export default function Page() { return <LegalDocumentPage document="deliveryReturns" />; }
