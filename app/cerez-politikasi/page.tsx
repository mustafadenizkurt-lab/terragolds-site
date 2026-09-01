import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "Çerez Politikası | Terragolds",
  description:
    "Terragolds web sitesinde kullanılan çerezler, amaçları ve çerez tercihlerinizi yönetme yöntemleri hakkında bilgi.",
  alternates: { canonical: "https://www.terragolds.com/cerez-politikasi" },
};
export default function Page() { return <LegalDocumentPage document="cookies" />; }
