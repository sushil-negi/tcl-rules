import { NextResponse } from "next/server";
import { getRulesDoc, invalidateRulesCache, League } from "@/lib/google-doc";
import {
  answerFromRegular,
  answerFromSeniorsOnly,
  AnswerSource,
} from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLeague(v: unknown): League {
  return v === "seniors" ? "seniors" : "regular";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: unknown;
      refresh?: unknown;
      league?: unknown;
    };
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: "Question is too long (max 2000 chars)" }, { status: 400 });
    }

    const league = parseLeague(body.league);

    if (body.refresh === true) {
      invalidateRulesCache(league);
      // For Seniors with refresh, also clear Regular since fallback may need it.
      if (league === "seniors") invalidateRulesCache("regular");
    }

    let answer: string;
    let source: AnswerSource;
    let docTitle: string;
    let docFetchedAt: string;

    if (league === "seniors") {
      // Pass 1: try the Seniors book in isolation. Most questions about
      // Seniors-specific play (deviations from Regular) should resolve here
      // without us ever fetching the Regular doc — saves a network round
      // trip and ~50% of LLM tokens on the common path.
      const seniors = await getRulesDoc("seniors");
      const pass1 = await answerFromSeniorsOnly({
        seniorsTitle: seniors.title,
        seniorsText: seniors.text,
        question,
      });

      if (pass1.source === "seniors") {
        answer = pass1.answer;
        source = "seniors";
        docTitle = seniors.title;
        docFetchedAt = new Date(seniors.fetchedAt).toISOString();
      } else {
        // Pass 2: Seniors is silent — fall through to Regular (with ICC fallback).
        const regular = await getRulesDoc("regular");
        const pass2 = await answerFromRegular({
          regularTitle: regular.title,
          regularText: regular.text,
          question,
        });
        answer = pass2.answer;
        source = pass2.source;
        docTitle = regular.title;
        docFetchedAt = new Date(regular.fetchedAt).toISOString();
      }
    } else {
      const regular = await getRulesDoc("regular");
      const result = await answerFromRegular({
        regularTitle: regular.title,
        regularText: regular.text,
        question,
      });
      answer = result.answer;
      source = result.source;
      docTitle = regular.title;
      docFetchedAt = new Date(regular.fetchedAt).toISOString();
    }

    return NextResponse.json({ answer, source, league, docTitle, docFetchedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Query error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
