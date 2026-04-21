import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  if (await isAdmin()) {
    redirect("/admin/issues");
  }
  redirect("/admin/login");
}
