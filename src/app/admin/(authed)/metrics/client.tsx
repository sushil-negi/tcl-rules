"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { Metrics } from "@/lib/metrics";
import { IssueStatus } from "@/lib/issues";

const ORANGE = "#f97316";
const AMBER = "#f59e0b";
const SLATE = "#64748b";

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  needs_rule_update: "Needs rule update",
};

function Kpi({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "orange" | "amber" | "green" | "red";
}) {
  const toneClass = {
    slate: "text-slate-900",
    orange: "text-orange-600",
    amber: "text-amber-700",
    green: "text-green-700",
    red: "text-red-700",
  }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-4 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function MetricsClient({ metrics }: { metrics: Metrics }) {
  const {
    kpis,
    newPerWeek,
    gapsPerWeek,
    byGround,
    byTournament,
    topTeams,
    topCallers,
    topSections,
    aging,
  } = metrics;

  const trendText =
    kpis.weekOverWeekPct === null
      ? "n/a"
      : `${kpis.weekOverWeekPct >= 0 ? "+" : ""}${kpis.weekOverWeekPct.toFixed(0)}%`;
  const trendTone: "slate" | "red" | "green" =
    kpis.weekOverWeekPct === null
      ? "slate"
      : kpis.weekOverWeekPct > 0
        ? "red"
        : kpis.weekOverWeekPct < 0
          ? "green"
          : "slate";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Metrics</h1>
        <Link href="/admin/issues" className="text-sm text-slate-600 hover:text-slate-900">
          Back to issues
        </Link>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Open" value={String(kpis.open)} tone="orange" />
        <Kpi
          label="Rule gaps"
          value={String(kpis.needsRule)}
          tone="amber"
          hint="AI-flagged gaps + admin-marked"
        />
        <Kpi label="Resolved" value={String(kpis.resolved)} tone="green" />
        <Kpi
          label="Avg to resolve"
          value={kpis.avgResolutionDays === null ? "—" : `${kpis.avgResolutionDays.toFixed(1)}d`}
          hint="From creation to resolved"
        />
        <Kpi label="Last 7d vs prior" value={trendText} tone={trendTone} hint="New issues trend" />
      </section>

      {/* Weekly charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="New issues per week (last 8 weeks)">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newPerWeek} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill={ORANGE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Rule-gap issues per week">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gapsPerWeek} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill={AMBER} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Category charts */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Issues by ground">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byGround}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={60} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill={ORANGE} radius={[0, 4, 4, 0]}>
                  {byGround.map((entry) => (
                    <Cell key={entry.key} fill={ORANGE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Issues by tournament">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byTournament}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill={SLATE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top teams">
          {topTeams.length === 0 ? (
            <p className="text-sm text-slate-600">No team data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topTeams.map((t, idx) => (
                <li key={t.key} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800 truncate">
                    <span className="text-slate-500 mr-2">{idx + 1}.</span>
                    {t.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mb-6">
        <Card title="Top callers">
          {topCallers.length === 0 ? (
            <p className="text-sm text-slate-600">No caller data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topCallers.map((c, idx) => (
                <li key={c.key} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800 truncate">
                    <span className="text-slate-500 mr-2">{idx + 1}.</span>
                    {c.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Aging issues */}
      <Card title={`Aging open issues (> 7 days) — ${aging.length}`} className="mb-6">
        {aging.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing older than 7 days. Nice.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {aging.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/issues/${encodeURIComponent(item.id)}`}
                  className="block py-3 hover:bg-slate-50 -mx-4 px-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 line-clamp-2">{item.description}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {STATUS_LABEL[item.status]}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                      {item.ageDays}d
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Top rule sections */}
      <Card title="Most-referenced rule sections">
        {topSections.length === 0 ? (
          <p className="text-sm text-slate-600">
            No rule citations yet. Sections will appear as issues are logged and analyzed.
          </p>
        ) : (
          <ul className="space-y-2">
            {topSections.map((s, idx) => {
              const maxCount = topSections[0].count;
              const pct = Math.round((s.count / maxCount) * 100);
              return (
                <li key={s.key}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="text-sm text-slate-800" title={s.label}>
                      <span className="text-slate-500 mr-2">{idx + 1}.</span>
                      {s.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 shrink-0">
                      {s.count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
