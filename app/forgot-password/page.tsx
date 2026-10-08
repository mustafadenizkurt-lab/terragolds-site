import type { Metadata } from "next";
import PasswordRecoveryForm from "../account/password-recovery-form";

export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <PasswordRecoveryForm mode="request" />;
}
