import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = { title: "Kullanım Koşulları | Terragolds" };
export default function Page() { return <LegalDocumentPage document="terms" />; }
