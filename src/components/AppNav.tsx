"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/interview", label: "Interview" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/products", label: "Products" },
  { href: "/knowledge", label: "My Expertise" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/wallet")
      .then((res) => res.json())
      .then((body) => setBalance(body.balance))
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
      <div className="flex items-center gap-5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname === link.href
                ? "text-sm font-semibold text-neutral-900"
                : "text-sm text-neutral-500 hover:text-neutral-700"
            }
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {balance !== null && (
          <span
            className={
              balance <= 0
                ? "rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                : "rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600"
            }
            title="AI credits — every generation call debits this"
          >
            {balance} credits
          </span>
        )}
        <button onClick={handleLogout} className="text-sm text-neutral-500 underline hover:text-neutral-700">
          Sign out
        </button>
      </div>
    </nav>
  );
}
