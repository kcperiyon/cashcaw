import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/knowledge");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <h1 className="text-3xl font-semibold text-neutral-900">Cashcaw</h1>
      <p className="mt-2 max-w-md text-neutral-500">
        Turn what you know into something people pay for.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/signup" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          Create account
        </Link>
        <Link href="/login" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          Sign in
        </Link>
      </div>
    </main>
  );
}
