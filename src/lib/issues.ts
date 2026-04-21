export type IssueStatus = "open" | "resolved" | "needs_rule_update";
export type AiStatus = "covered" | "gap" | "unclear";
export type Tournament = "regular" | "seniors" | "fireworks";

export const TOURNAMENTS: readonly Tournament[] = ["regular", "seniors", "fireworks"] as const;

export const TOURNAMENT_LABEL: Record<Tournament, string> = {
  regular: "Regular",
  seniors: "Seniors",
  fireworks: "Fireworks",
};

export interface Issue {
  id: string;
  year: number;
  isoWeek: number;
  tournament: Tournament;
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
  "tournament",
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

// Each tournament's Week 1 is the Saturday of its first game weekend.
const DEFAULT_TOURNAMENT_STARTS: Record<Tournament, string> = {
  regular: "2026-04-18",
  seniors: "2026-04-25",
  fireworks: "2026-04-18", // placeholder — override with SEASON_START_FIREWORKS
};

function parseDate(str: string): Date | null {
  const parts = str.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function tournamentStart(t: Tournament): Date {
  const envKey = `SEASON_START_${t.toUpperCase()}` as const;
  const raw = process.env[envKey] || DEFAULT_TOURNAMENT_STARTS[t];
  return parseDate(raw) ?? parseDate(DEFAULT_TOURNAMENT_STARTS[t])!;
}

// Saturday on or before the given date.
function saturdayOnOrBefore(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const back = (d.getUTCDay() + 1) % 7; // Sun→1, Mon→2, … Fri→6, Sat→0
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}

export function seasonWeek(d: Date, tournament: Tournament = "regular"): {
  year: number;
  week: number;
} {
  const startSat = saturdayOnOrBefore(tournamentStart(tournament));
  const reportedSat = saturdayOnOrBefore(d);
  const diffDays = Math.round((reportedSat.getTime() - startSat.getTime()) / 86400000);
  const week = Math.max(1, Math.floor(diffDays / 7) + 1);
  return { year: startSat.getUTCFullYear(), week };
}

// Back-compat alias — older call sites kept working.
export const isoWeek = seasonWeek;

export function newIssueId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

function normalizeTournament(v: string): Tournament {
  return (TOURNAMENTS as readonly string[]).includes(v) ? (v as Tournament) : "regular";
}

export function issueToRow(issue: Issue): string[] {
  return [
    issue.id,
    String(issue.year),
    String(issue.isoWeek),
    issue.tournament,
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
  if (!row[0]) return null;
  const pad = [...row];
  while (pad.length < ISSUE_HEADERS.length) pad.push("");
  const [
    id,
    year,
    iso_week,
    tournament,
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
  ] = pad;
  return {
    id,
    year: Number(year) || 0,
    isoWeek: Number(iso_week) || 0,
    tournament: normalizeTournament(tournament),
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
  tournament: Tournament;
  year: number;
  week: number;
  label: string;
  issues: Issue[];
}> {
  const map = new Map<
    string,
    { tournament: Tournament; year: number; week: number; issues: Issue[] }
  >();
  for (const issue of issues) {
    const key = `${issue.tournament}-${issue.year}-${String(issue.isoWeek).padStart(2, "0")}`;
    const entry = map.get(key) ?? {
      tournament: issue.tournament,
      year: issue.year,
      week: issue.isoWeek,
      issues: [],
    };
    entry.issues.push(issue);
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      // Sort by tournament (regular > seniors > fireworks stable), then newest week first
      const ta = a[1].tournament;
      const tb = b[1].tournament;
      const tOrder = TOURNAMENTS.indexOf(ta) - TOURNAMENTS.indexOf(tb);
      if (tOrder !== 0) return tOrder;
      return a[1].week === b[1].week
        ? b[1].year - a[1].year
        : b[1].week - a[1].week;
    })
    .map(([, v]) => ({
      tournament: v.tournament,
      year: v.year,
      week: v.week,
      label: `${TOURNAMENT_LABEL[v.tournament]} · Week ${v.week}`,
      issues: v.issues.sort((a, b) => (a.reportedAt < b.reportedAt ? 1 : -1)),
    }));
}
