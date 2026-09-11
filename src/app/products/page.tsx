import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProductsClient } from "./ProductsClient";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ProductsClient />;
}
