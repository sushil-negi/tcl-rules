"use client";

import { useState, useEffect } from "react";
import { Issue, IssueStatus, AiStatus, TOURNAMENT_LABEL, GROUND_LABEL } from "@/lib/issues";
import { fmtDateTime } from "@/lib/dates";

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "needs_rule_update", label: "Needs rule update" },
  { value: "resolved", label: "Resolved" },
];

const AI_BADGE: Record<AiStatus, { text: string; className: string; description: string }> = {
  analyzing: {
    text: "Analyzing…",
    className: "bg-blue-100 text-blue-800 animate-pulse",
    description: "Gemini is analyzing this issue against the rules. This page will update automatically.",
  },
  covered: {
    text: "Covered by rules",
    className: "bg-green-100 text-green-800",
    description: "The rules document addresses this situation.",
  },
  gap: {
    text: "Gap in rules",
    className: "bg-amber-100 text-amber-800",
    description: "The rules do not address this — consider adding a new rule.",
  },
  unclear: {
    text: "Unclear / partial",
    className: "bg-slate-100 text-slate-700",
    description: "The rules partially address this or are ambiguous.",
  },
};

export default function IssueDetailClient({ initialIssue }: { initialIssue: Issue }) {
  const [issue, setIssue] = useState<Issue>(initialIssue);
  const [status, setStatus] = useState<IssueStatus>(initialIssue.status);
  const [resolution, setResolution] = useState(initialIssue.resolution);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Poll while Gemini's background analysis is running.
  useEffect(() => {
    if (issue.aiStatus !== "analyzing") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/issues/${encodeURIComponent(issue.id)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { issue?: Issue };
        if (data.issue && data.issue.aiStatus !== "analyzing") {
          setIssue(data.issue);
          setStatus(data.issue.status);
        }
      } catch {
        // ignore and retry on next tick
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [issue.aiStatus, issue.id]);

  async function save(overrideStatus?: IssueStatus) {
    setSaving(true);
    setSaved(false);
    setError("");
    const nextStatus = overrideStatus ?? status;
    if (nextStatus === "resolved" && !resolution.trim()) {
      setError("Add a short resolution before marking this issue resolved.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/issues/${encodeURIComponent(issue.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, resolution }),
      });
      const data = (await res.json()) as { issue?: Issue; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      if (data.issue) {
        // Server returns only the fields it changed; merge on top of
        // existing state to keep untouched fields intact.
        setIssue((prev) => ({ ...prev, ...data.issue }));
        if (data.issue.status) setStatus(data.issue.status);
        if (typeof data.issue.resolution === "string") setResolution(data.issue.resolution);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">Issue details</h1>
      <p className="text-xs text-slate-500 mb-5 break-all">
        {TOURNAMENT_LABEL[issue.tournament]} · Week {issue.isoWeek} · Ground: {GROUND_LABEL[issue.ground]} · ID: {issue.id}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Report
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Description</dt>
              <dd className="text-slate-900 whitespace-pre-wrap mt-0.5">{issue.description}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-slate-500">Team</dt>
                <dd className="text-slate-900 mt-0.5">{issue.team || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Caller</dt>
                <dd className="text-slate-900 mt-0.5">{issue.caller || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Logged by</dt>
                <dd className="text-slate-900 mt-0.5">{issue.reporter || "—"}</dd>
              </div>
            </div>
            <div>
              <dt className="text-slate-500">Reported at</dt>
              <dd className="text-slate-900 mt-0.5">{fmtDateTime(issue.reportedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Rules analysis
          </h2>
          <div className="mb-3">
            <span
              className={`inline-block text-xs font-semibold uppercase px-2 py-1 rounded ${AI_BADGE[issue.aiStatus].className}`}
            >
              {AI_BADGE[issue.aiStatus].text}
            </span>
            <p className="text-xs text-slate-500 mt-2">{AI_BADGE[issue.aiStatus].description}</p>
          </div>
          {issue.aiRelatedSection && (
            <div className="mb-3">
              <p className="text-xs text-slate-500">Related section</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap mt-0.5">
                {issue.aiRelatedSection}
              </p>
            </div>
          )}
          {issue.aiSuggestedWording && (
            <div>
              <p className="text-xs text-slate-500">
                {issue.aiStatus === "gap" ? "Suggested new rule" : "Suggested clarification"}
              </p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap mt-0.5 bg-amber-50 border border-amber-200 rounded p-2">
                {issue.aiSuggestedWording}
              </p>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 lg:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Status &amp; resolution
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as IssueStatus)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={saving}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="resolution" className="block text-sm font-medium text-slate-700 mb-1">
                Resolution / notes
              </label>
              <textarea
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                placeholder="How was this handled? Any follow-up needed?"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-slate-500">
                Saved to the existing row in the issues sheet (column &quot;resolution&quot;).
              </p>
            </div>
            {error && (
              <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => save()}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => save("resolved")}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Save as resolved
                </button>
              )}
              {saved && <span className="text-sm text-green-700 self-center">Saved</span>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
