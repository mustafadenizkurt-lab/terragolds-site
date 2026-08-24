import type { Metadata } from "next";
import { requireAuthorizedAdmin } from "../../lib/admin-auth";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yönetim Paneli | Terragolds",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await requireAuthorizedAdmin("/admin");
  return <AdminClient user={{ name: user.displayName, email: user.email }} />;
}
