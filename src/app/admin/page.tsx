import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  if (await isAdmin()) {
    redirect("/admin/issues");
  }
  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-16">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Admin sign in</h1>
      <p className="text-sm text-slate-600 mb-6">Enter the admin password to continue.</p>
      <LoginForm />
    </div>
  );
}
