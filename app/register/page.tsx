import type { Metadata } from "next";
import AuthForm from "../account/auth-form";

export const metadata: Metadata = {
  title: "Üye Ol | Terragolds",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
