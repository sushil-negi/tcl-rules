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
      <nav className="flex items-center flex-wrap gap-4 mb-5 text-sm">
        <Link
          href="/admin/issues"
          className="text-slate-700 hover:text-slate-900 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 rounded"
        >
          All issues
        </Link>
        <Link
          href="/admin/metrics"
          className="text-slate-700 hover:text-slate-900 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 rounded"
        >
          Metrics
        </Link>
        <Link
          href="/admin/issues/new"
          className="text-orange-700 hover:text-orange-800 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 rounded"
        >
          + New issue
        </Link>
      </nav>
      {children}
    </div>
  );
}
