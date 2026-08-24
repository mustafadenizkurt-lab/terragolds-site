import type { Metadata } from "next";
import VerifyEmailClient from "./verify-email-client";

export const metadata: Metadata = {
  title: "E-posta Doğrulama",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
