"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Image from "next/image";
import { fmtDateTime } from "@/lib/dates";

type AnswerSource = "tcl" | "icc" | "none";

interface QueryResponse {
  answer: string;
  source: AnswerSource;
  docTitle: string;
  docFetchedAt: string;
}

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  source: AnswerSource;
  docTitle: string;
  askedAt: string;
}

const SOURCE_BADGE: Record<AnswerSource, { label: string; className: string }> = {
  tcl: { label: "From TCL rules", className: "bg-green-100 text-green-800" },
  icc: { label: "From ICC ODI rules (TCL silent)", className: "bg-blue-100 text-blue-800" },
  none: { label: "Not in TCL or ICC", className: "bg-slate-200 text-slate-900" },
};

const STORAGE_KEY = "tcl-rules-history-v1";
const MAX_HISTORY = 50;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded — silently drop
  }
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [source, setSource] = useState<AnswerSource | null>(null);
  const [meta, setMeta] = useState<{ docTitle: string; docFetchedAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>, refresh = false) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setAnswer(null);
    setSource(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, refresh }),
      });
      const data = (await res.json()) as QueryResponse | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : `Request failed (${res.status})`);
        return;
      }
      setAnswer(data.answer);
      setSource(data.source);
      setMeta({ docTitle: data.docTitle, docFetchedAt: data.docFetchedAt });
      pushHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question: trimmed,
        answer: data.answer,
        source: data.source,
        docTitle: data.docTitle,
        askedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    if (!confirm("Clear your question history? This can't be undone.")) return;
    setHistory([]);
    setExpandedId(null);
    saveHistory([]);
  }

  function reuseQuestion(q: string) {
    setQuestion(q);
    setHistoryOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const examples = [
    "How many players are on each side?",
    "What is the procedure for rain delays?",
    "What are the rules around player substitutions?",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-orange-50/40 flex flex-col">
      <header className="bg-[#1E2533] text-white py-4 sm:py-5 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-center sm:justify-start gap-3 sm:gap-4">
          <div className="bg-white rounded-full p-1 sm:p-1.5 shadow-md shrink-0">
            <Image
              src="/tcl-logo.png"
              alt="Tennis Cricket League Logo"
              width={52}
              height={52}
              className="w-10 h-10 sm:w-[52px] sm:h-[52px]"
              priority
            />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-lg sm:text-2xl font-bold tracking-wide leading-tight">
              Tennis Cricket League
            </h1>
            <p className="text-orange-200 text-xs sm:text-sm mt-0.5">Ask About the Rules</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Ask a question about the TCL rules
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Answers come only from the official TCL rules document and are generated live.
          </p>
        </section>

        <form
          onSubmit={(e) => handleSubmit(e, false)}
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-5"
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How many overs are played in a match?"
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
            disabled={loading}
          />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex items-center justify-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold shadow-sm disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors w-full sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Thinking…
                </>
              ) : (
                "Ask"
              )}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e as unknown as FormEvent<HTMLFormElement>, true)}
              disabled={loading || !question.trim()}
              className="text-xs text-slate-700 hover:text-slate-900 underline underline-offset-2 disabled:text-slate-400 disabled:no-underline self-start sm:self-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 rounded"
              title="Re-fetch the latest rules doc from Drive before answering (normally cached for 1 week)"
            >
              Refresh rules &amp; ask
            </button>
          </div>

          {!answer && !loading && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-600 mb-2">Try:</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuestion(ex)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {answer && (
          <section className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Answer
              </h3>
              {source && (
                <span
                  className={`text-[10px] sm:text-xs font-semibold uppercase px-2 py-0.5 rounded ${SOURCE_BADGE[source].className}`}
                >
                  {SOURCE_BADGE[source].label}
                </span>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-5">
              <div className="whitespace-pre-wrap text-slate-900 text-sm sm:text-base leading-relaxed">
                {answer}
              </div>
              {meta && (
                <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  TCL doc: <span className="font-medium">{meta.docTitle}</span> · fetched{" "}
                  {fmtDateTime(meta.docFetchedAt)}
                </p>
              )}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <div className="flex items-center justify-between py-2">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex items-center gap-2 text-left text-sm font-semibold text-slate-700 hover:text-slate-900"
                aria-expanded={historyOpen}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Previous questions ({history.length})
              </button>
              {historyOpen && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-slate-600 hover:text-red-600 underline underline-offset-2"
                >
                  Clear all
                </button>
              )}
            </div>

            {historyOpen && (
              <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white overflow-hidden">
                {history.map((entry) => {
                  const isOpen = expandedId === entry.id;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : entry.id)}
                        className="w-full text-left px-3 sm:px-4 py-3 hover:bg-slate-50 transition-colors"
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">
                              {entry.question}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {fmtDateTime(entry.askedAt)}
                            </p>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 text-slate-500 shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 sm:px-4 pb-4 bg-slate-50 border-t border-slate-200">
                          {entry.source && (
                            <span
                              className={`inline-block mt-3 text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${SOURCE_BADGE[entry.source].className}`}
                            >
                              {SOURCE_BADGE[entry.source].label}
                            </span>
                          )}
                          <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed pt-3">
                            {entry.answer}
                          </div>
                          <button
                            type="button"
                            onClick={() => reuseQuestion(entry.question)}
                            className="mt-3 text-xs text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2"
                          >
                            Ask again
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-6">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.94 1.515l.547 2.19a2 2 0 01-.45 1.9l-1.27 1.27a11.04 11.04 0 005.58 5.58l1.27-1.27a2 2 0 011.9-.45l2.19.547A2 2 0 0121 16.72V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Still have questions?</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Call the TCL on-call support line.
            </p>
          </div>
          <a
            href="tel:+14849229596"
            className="inline-flex items-center justify-center rounded-md bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold shadow-sm whitespace-nowrap"
          >
            (484) 922-9596
          </a>
        </div>
      </section>

      <footer className="py-4 px-4 text-center text-xs text-slate-600 border-t border-slate-200 bg-white/60">
        Tennis Cricket League · Rules queries powered by the official rules document
      </footer>
    </div>
  );
}
