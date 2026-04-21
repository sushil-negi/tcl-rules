import Link from "next/link";
import { listIssues } from "@/lib/sheets";
import { groupByWeek, Issue, IssueStatus, AiStatus, GROUND_LABEL } from "@/lib/issues";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  needs_rule_update: "Needs rule update",
};

const AI_BADGE: Record<AiStatus, { text: string; className: string }> = {
  analyzing: { text: "Analyzing…", className: "bg-blue-100 text-blue-800 animate-pulse" },
  covered: { text: "Covered", className: "bg-green-100 text-green-800" },
  gap: { text: "Gap", className: "bg-amber-100 text-amber-800" },
  unclear: { text: "Unclear", className: "bg-slate-100 text-slate-700" },
};

const STATUS_BADGE: Record<IssueStatus, string> = {
  open: "bg-sky-100 text-sky-800",
  resolved: "bg-slate-100 text-slate-700",
  needs_rule_update: "bg-orange-100 text-orange-800",
};

export default async function IssuesPage() {
  let issues: Issue[] = [];
  let error: string | null = null;
  try {
    issues = await listIssues();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load issues";
  }

  const groups = groupByWeek(issues);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Support Issues</h1>
        <span className="text-sm text-slate-500">
          {issues.length} total
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!error && issues.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 mb-3">No issues logged yet.</p>
          <Link
            href="/admin/issues/new"
            className="inline-flex items-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold"
          >
            Log first issue
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={`${group.year}-${group.week}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {group.label}{" "}
              <span className="text-slate-400 font-normal">
                · {group.issues.length} issue{group.issues.length === 1 ? "" : "s"}
              </span>
            </h2>
            <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
              {group.issues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/admin/issues/${encodeURIComponent(issue.id)}`}
                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 line-clamp-2">
                          {issue.description}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(issue.reportedAt).toLocaleString()}
                          {` · ${GROUND_LABEL[issue.ground]}`}
                          {issue.caller ? ` · caller: ${issue.caller}` : ""}
                          {issue.reporter ? ` · logged by: ${issue.reporter}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${AI_BADGE[issue.aiStatus].className}`}
                        >
                          {AI_BADGE[issue.aiStatus].text}
                        </span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[issue.status]}`}
                        >
                          {STATUS_LABEL[issue.status]}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
