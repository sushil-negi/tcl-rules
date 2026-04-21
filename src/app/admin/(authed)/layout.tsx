import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    redirect("/admin");
  }
  return (
    <div>
      <nav className="flex items-center gap-4 mb-5 text-sm">
        <Link
          href="/admin/issues"
          className="text-slate-600 hover:text-slate-900 font-medium"
        >
          All issues
        </Link>
        <Link
          href="/admin/issues/new"
          className="text-orange-600 hover:text-orange-700 font-medium"
        >
          + New issue
        </Link>
      </nav>
      {children}
    </div>
  );
}
