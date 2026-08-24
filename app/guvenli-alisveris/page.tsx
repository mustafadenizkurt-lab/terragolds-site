import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Güvenli Alışveriş | Terragolds",
  description:
    "Terragolds'ta ödeme güvenliği, iade hakkınız ve kişisel verilerinizin korunmasına dair bilgiler.",
};

export default function SecureShoppingPage() {
  return <LegalDocumentPage document="secureShopping" />;
}
