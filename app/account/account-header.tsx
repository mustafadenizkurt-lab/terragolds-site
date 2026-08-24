"use client";

import Link from "next/link";

export default function AccountHeader({
  active,
}: {
  active: "profile" | "orders";
}) {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="profile-header">
      <Link className="profile-brand" href="/">
        TERRA<strong>GOLDS</strong>
      </Link>
      <nav>
        <Link className={active === "profile" ? "active" : ""} href="/profile">
          Profilim
        </Link>
        <Link className={active === "orders" ? "active" : ""} href="/orders">
          Siparişlerim
        </Link>
        <button type="button" onClick={logout}>
          Çıkış yap
        </button>
      </nav>
    </header>
  );
}
