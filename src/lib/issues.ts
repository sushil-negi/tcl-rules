export type IssueStatus = "open" | "resolved" | "needs_rule_update";
export type AiStatus = "covered" | "gap" | "unclear";

export interface Issue {
  id: string;
  year: number;
  isoWeek: number;
  reportedAt: string;
  reporter: string;
  caller: string;
  description: string;
  aiStatus: AiStatus;
  aiRelatedSection: string;
  aiSuggestedWording: string;
  status: IssueStatus;
  resolution: string;
  createdAt: string;
  updatedAt: string;
}

export const ISSUE_HEADERS = [
  "id",
  "year",
  "iso_week",
  "reported_at",
  "reporter",
  "caller",
  "description",
  "ai_status",
  "ai_related_section",
  "ai_suggested_wording",
  "status",
  "resolution",
  "created_at",
  "updated_at",
] as const;

export function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diffDays = Math.round((date.getTime() - firstThursday.getTime()) / 86400000);
  const week = 1 + Math.floor(diffDays / 7);
  return { year: date.getUTCFullYear(), week };
}

export function newIssueId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export function issueToRow(issue: Issue): string[] {
  return [
    issue.id,
    String(issue.year),
    String(issue.isoWeek),
    issue.reportedAt,
    issue.reporter,
    issue.caller,
    issue.description,
    issue.aiStatus,
    issue.aiRelatedSection,
    issue.aiSuggestedWording,
    issue.status,
    issue.resolution,
    issue.createdAt,
    issue.updatedAt,
  ];
}

export function rowToIssue(row: string[]): Issue | null {
  if (row.length < ISSUE_HEADERS.length) return null;
  const [
    id,
    year,
    iso_week,
    reported_at,
    reporter,
    caller,
    description,
    ai_status,
    ai_related_section,
    ai_suggested_wording,
    status,
    resolution,
    created_at,
    updated_at,
  ] = row;
  if (!id) return null;
  return {
    id,
    year: Number(year) || 0,
    isoWeek: Number(iso_week) || 0,
    reportedAt: reported_at || "",
    reporter: reporter || "",
    caller: caller || "",
    description: description || "",
    aiStatus: (ai_status as AiStatus) || "unclear",
    aiRelatedSection: ai_related_section || "",
    aiSuggestedWording: ai_suggested_wording || "",
    status: (status as IssueStatus) || "open",
    resolution: resolution || "",
    createdAt: created_at || "",
    updatedAt: updated_at || "",
  };
}

export function groupByWeek(issues: Issue[]): Array<{
  year: number;
  week: number;
  label: string;
  issues: Issue[];
}> {
  const map = new Map<string, { year: number; week: number; issues: Issue[] }>();
  for (const issue of issues) {
    const key = `${issue.year}-${String(issue.isoWeek).padStart(2, "0")}`;
    const entry = map.get(key) ?? { year: issue.year, week: issue.isoWeek, issues: [] };
    entry.issues.push(issue);
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, v]) => ({
      year: v.year,
      week: v.week,
      label: `Week ${v.week}, ${v.year}`,
      issues: v.issues.sort((a, b) => (a.reportedAt < b.reportedAt ? 1 : -1)),
    }));
}
