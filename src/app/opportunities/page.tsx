import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { OpportunitiesClient } from "./OpportunitiesClient";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <OpportunitiesClient />;
}
