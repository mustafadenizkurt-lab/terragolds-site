import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | Terragolds",
  description:
    "Terragolds web sitesi kullanım koşulları: hizmet şartları, kullanıcı yükümlülükleri ve yasal bilgiler.",
  alternates: { canonical: "https://www.terragolds.com/kullanim-kosullari" },
};
export default function Page() { return <LegalDocumentPage document="terms" />; }
