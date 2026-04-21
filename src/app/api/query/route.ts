import { NextResponse } from "next/server";
import { getRulesDoc, invalidateRulesCache } from "@/lib/google-doc";
import { answerQuestion } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: unknown; refresh?: unknown };
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: "Question is too long (max 2000 chars)" }, { status: 400 });
    }

    if (body.refresh === true) invalidateRulesCache();

    const doc = await getRulesDoc();
    const answer = await answerQuestion({
      question,
      docTitle: doc.title,
      docText: doc.text,
    });

    return NextResponse.json({
      answer,
      docTitle: doc.title,
      docFetchedAt: new Date(doc.fetchedAt).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Query error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
