"use client";

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
      <div className="flex gap-5">
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
      <button onClick={handleLogout} className="text-sm text-neutral-500 underline hover:text-neutral-700">
        Sign out
      </button>
    </nav>
  );
}
