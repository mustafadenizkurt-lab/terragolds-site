import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "Terragolds'un KVKK kapsamında kişisel verilerinizin işlenmesi, saklanması ve haklarınıza dair aydınlatma metni.",
  alternates: { canonical: "https://www.terragolds.com/kvkk" },
};
export default function Page() { return <LegalDocumentPage document="kvkk" />; }
