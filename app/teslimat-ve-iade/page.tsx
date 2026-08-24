import type { Metadata } from "next";
import LegalDocumentPage from "../legal/legal-document-page";

export const metadata: Metadata = { title: "Teslimat, İptal ve İade | Terragolds" };
export default function Page() { return <LegalDocumentPage document="deliveryReturns" />; }
