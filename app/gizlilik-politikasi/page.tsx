import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = { title: "Gizlilik Politikası | Terragolds" };
export default function Page() { return <LegalDocumentPage document="privacy" />; }
