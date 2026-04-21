import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue } from "@/lib/sheets";
import IssueDetailClient from "./client";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  return (
    <div>
      <Link href="/admin/issues" className="text-sm text-slate-600 hover:text-slate-900">
        ← All issues
      </Link>
      <IssueDetailClient initialIssue={issue} />
    </div>
  );
}
