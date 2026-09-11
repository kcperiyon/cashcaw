import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InterviewClient } from "./InterviewClient";

export default async function InterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <InterviewClient />;
}
