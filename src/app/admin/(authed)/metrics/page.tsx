import { listIssues } from "@/lib/sheets";
import { computeMetrics } from "@/lib/metrics";
import MetricsClient from "./client";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  let metrics = null;
  let error: string | null = null;
  try {
    const issues = await listIssues();
    metrics = computeMetrics(issues);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load metrics";
  }

  if (error || !metrics) {
    return (
      <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {error ?? "No metrics available."}
      </div>
    );
  }

  return <MetricsClient metrics={metrics} />;
}
