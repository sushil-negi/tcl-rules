"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ONCALL_NAMES } from "@/lib/oncall";
import { TEAMS } from "@/lib/teams";
import {
  TOURNAMENTS,
  TOURNAMENT_LABEL,
  Tournament,
  GROUNDS,
  GROUND_LABEL,
  Ground,
} from "@/lib/issues";

export default function NewIssuePage() {
  const router = useRouter();
  const [reporter, setReporter] = useState("");
  const [caller, setCaller] = useState("");
  const [team, setTeam] = useState("");
  const [description, setDescription] = useState("");
  const [tournament, setTournament] = useState<Tournament>("regular");
  const [ground, setGround] = useState<Ground>("phx");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporter, caller, team, description, tournament, ground }),
      });
      const data = (await res.json()) as { issue?: { id: string }; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      if (data.issue?.id) {
        router.push(`/admin/issues/${encodeURIComponent(data.issue.id)}`);
        router.refresh();
      } else {
        router.push("/admin/issues");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">
        Log a new issue
      </h1>
      <p className="text-sm text-slate-600 mb-5">
        Gemini will automatically check the issue against the current rules doc and flag gaps.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tournament <span className="text-red-600">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TOURNAMENTS.map((t) => (
              <label
                key={t}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  tournament === t
                    ? "border-orange-500 bg-orange-50 text-orange-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="tournament"
                  value={t}
                  checked={tournament === t}
                  onChange={() => setTournament(t)}
                  className="accent-orange-500"
                  disabled={loading}
                />
                {TOURNAMENT_LABEL[t]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Ground <span className="text-red-600">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {GROUNDS.map((g) => (
              <label
                key={g}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  ground === g
                    ? "border-orange-500 bg-orange-50 text-orange-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="ground"
                  value={g}
                  checked={ground === g}
                  onChange={() => setGround(g)}
                  className="accent-orange-500"
                  disabled={loading}
                />
                {GROUND_LABEL[g]}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reporter" className="block text-sm font-medium text-slate-700 mb-1">
              Logged by (on-call)
            </label>
            <input
              id="reporter"
              type="text"
              list="oncall-names"
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="Start typing your name…"
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={loading}
            />
            <datalist id="oncall-names">
              {ONCALL_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="caller" className="block text-sm font-medium text-slate-700 mb-1">
              Caller
            </label>
            <input
              id="caller"
              type="text"
              value={caller}
              onChange={(e) => setCaller(e.target.value)}
              placeholder="Person who reported"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="team" className="block text-sm font-medium text-slate-700 mb-1">
            Team
          </label>
          <input
            id="team"
            type="text"
            list="team-names"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Start typing the team name…"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={loading}
          />
          <datalist id="team-names">
            {TEAMS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
            Issue description <span className="text-red-600">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what was reported, including team, match, and any context…"
            rows={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
            disabled={loading}
            required
          />
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="inline-flex items-center justify-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Analyzing & saving…" : "Save issue"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/issues")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
