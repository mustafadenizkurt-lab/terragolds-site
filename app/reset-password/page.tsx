import type { Metadata } from "next";
import PasswordRecoveryForm from "../account/password-recovery-form";

export const metadata: Metadata = {
  title: "Yeni Şifre | Terragolds",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <PasswordRecoveryForm mode="reset" token={token} />;
}
