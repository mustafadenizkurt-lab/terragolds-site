import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Terragolds",
  description:
    "Terragolds gizlilik politikası: kişisel verilerinizin toplanması, kullanımı ve korunmasına dair detaylı bilgi.",
  alternates: { canonical: "https://www.terragolds.com/gizlilik-politikasi" },
};
export default function Page() { return <LegalDocumentPage document="privacy" />; }
