import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { KnowledgeClient } from "./KnowledgeClient";

export default async function KnowledgePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <KnowledgeClient />;
}
