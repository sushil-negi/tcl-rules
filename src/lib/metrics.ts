import {
  Issue,
  Tournament,
  TOURNAMENTS,
  TOURNAMENT_LABEL,
  Ground,
  GROUNDS,
  GROUND_LABEL,
} from "./issues";

const MS_PER_DAY = 86_400_000;

function sundayOfWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = date.getUTCDay();
  const add = dow === 0 ? 0 : 7 - dow;
  date.setUTCDate(date.getUTCDate() + add);
  return date;
}

function weekKey(d: Date): string {
  const s = sundayOfWeek(d);
  return s.toISOString().slice(0, 10); // YYYY-MM-DD of the week's Sunday
}

function weekLabel(d: Date): string {
  const s = sundayOfWeek(d);
  return s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface Kpis {
  total: number;
  open: number;
  needsRule: number;
  resolved: number;
  avgResolutionDays: number | null;
  weekOverWeekPct: number | null; // vs previous 7 days
}

export interface WeekBucket {
  weekEndingISO: string;
  label: string;
  count: number;
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export interface AgingItem {
  id: string;
  description: string;
  ageDays: number;
  status: Issue["status"];
  tournament: Tournament;
  ground: Ground;
}

export interface Metrics {
  kpis: Kpis;
  newPerWeek: WeekBucket[];
  gapsPerWeek: WeekBucket[];
  byGround: CountRow[];
  byTournament: CountRow[];
  topTeams: CountRow[];
  topCallers: CountRow[];
  topSections: CountRow[];
  aging: AgingItem[];
}

function avgResolutionDays(issues: Issue[]): number | null {
  const resolved = issues.filter((i) => i.status === "resolved" && i.createdAt && i.updatedAt);
  if (resolved.length === 0) return null;
  const total = resolved.reduce((sum, i) => {
    const created = new Date(i.createdAt).getTime();
    const updated = new Date(i.updatedAt).getTime();
    const diff = Math.max(0, updated - created);
    return sum + diff;
  }, 0);
  return total / resolved.length / MS_PER_DAY;
}

function weekOverWeekPct(issues: Issue[], now: Date): number | null {
  const nowMs = now.getTime();
  const lastWeekStart = nowMs - 7 * MS_PER_DAY;
  const prevWeekStart = nowMs - 14 * MS_PER_DAY;
  let thisWeek = 0;
  let lastWeek = 0;
  for (const i of issues) {
    const t = new Date(i.reportedAt).getTime();
    if (t >= lastWeekStart && t < nowMs) thisWeek += 1;
    else if (t >= prevWeekStart && t < lastWeekStart) lastWeek += 1;
  }
  if (lastWeek === 0) return thisWeek === 0 ? 0 : null; // null = "new"
  return ((thisWeek - lastWeek) / lastWeek) * 100;
}

function weeklyBuckets(
  issues: Issue[],
  now: Date,
  weeks: number,
  predicate: (i: Issue) => boolean
): WeekBucket[] {
  const todaySunday = sundayOfWeek(now);
  const buckets = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(todaySunday.getTime() - i * 7 * MS_PER_DAY);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { weekEndingISO: key, label: weekLabel(d), count: 0 });
  }
  const firstKey = Array.from(buckets.keys())[0];
  const firstDate = new Date(firstKey).getTime();
  for (const issue of issues) {
    if (!predicate(issue)) continue;
    const reported = new Date(issue.reportedAt);
    if (reported.getTime() < firstDate - 6 * MS_PER_DAY) continue;
    const key = weekKey(reported);
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
  }
  return Array.from(buckets.values());
}

function byCategory<T extends string>(
  issues: Issue[],
  getKey: (i: Issue) => T,
  allKeys: readonly T[],
  labelOf: (k: T) => string
): CountRow[] {
  const counts = new Map<T, number>();
  for (const k of allKeys) counts.set(k, 0);
  for (const issue of issues) {
    const k = getKey(issue);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return allKeys.map((k) => ({ key: k, label: labelOf(k), count: counts.get(k) ?? 0 }));
}

function topCallers(issues: Issue[], limit: number): CountRow[] {
  const counts = new Map<string, number>();
  for (const i of issues) {
    const name = i.caller?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function topTeams(issues: Issue[], limit: number): CountRow[] {
  const counts = new Map<string, number>();
  for (const i of issues) {
    const name = i.team?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function normalizeSection(raw: string): string {
  const s = (raw || "").trim();
  if (!s || /^none$/i.test(s)) return "";
  // Collapse whitespace and cap length for grouping; show full in UI via title attr.
  return s.replace(/\s+/g, " ").slice(0, 120);
}

function topSections(issues: Issue[], limit: number): CountRow[] {
  const counts = new Map<string, number>();
  for (const i of issues) {
    const key = normalizeSection(i.aiRelatedSection);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function agingOpen(issues: Issue[], minDays: number, now: Date): AgingItem[] {
  const cutoffMs = now.getTime() - minDays * MS_PER_DAY;
  const items: AgingItem[] = [];
  for (const i of issues) {
    if (i.status === "resolved") continue;
    const createdMs = new Date(i.createdAt || i.reportedAt).getTime();
    if (createdMs > cutoffMs) continue;
    const ageDays = Math.floor((now.getTime() - createdMs) / MS_PER_DAY);
    items.push({
      id: i.id,
      description: i.description,
      ageDays,
      status: i.status,
      tournament: i.tournament,
      ground: i.ground,
    });
  }
  return items.sort((a, b) => b.ageDays - a.ageDays);
}

export function computeMetrics(issues: Issue[], now: Date = new Date()): Metrics {
  const total = issues.length;
  const open = issues.filter((i) => i.status === "open").length;
  const needsRule = issues.filter((i) => i.status === "needs_rule_update").length;
  const resolved = issues.filter((i) => i.status === "resolved").length;

  return {
    kpis: {
      total,
      open,
      needsRule,
      resolved,
      avgResolutionDays: avgResolutionDays(issues),
      weekOverWeekPct: weekOverWeekPct(issues, now),
    },
    newPerWeek: weeklyBuckets(issues, now, 8, () => true),
    gapsPerWeek: weeklyBuckets(
      issues,
      now,
      8,
      (i) => i.aiStatus === "gap" || i.status === "needs_rule_update"
    ),
    byGround: byCategory<Ground>(issues, (i) => i.ground, GROUNDS, (k) => GROUND_LABEL[k]),
    byTournament: byCategory<Tournament>(
      issues,
      (i) => i.tournament,
      TOURNAMENTS,
      (k) => TOURNAMENT_LABEL[k]
    ),
    topTeams: topTeams(issues, 10),
    topCallers: topCallers(issues, 10),
    topSections: topSections(issues, 5),
    aging: agingOpen(issues, 7, now),
  };
}
