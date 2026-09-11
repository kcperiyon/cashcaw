import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProductClient } from "./ProductClient";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  return <ProductClient productId={id} />;
}
