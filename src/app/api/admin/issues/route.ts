import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { appendIssue, listIssues } from "@/lib/sheets";
import { getRulesDoc } from "@/lib/google-doc";
import { analyzeIssueAgainstRules } from "@/lib/gemini";
import { Issue, seasonWeek, newIssueId } from "@/lib/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const issues = await listIssues();
    return NextResponse.json({ issues });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      reporter?: unknown;
      caller?: unknown;
      description?: unknown;
    };
    const reporter = typeof body.reporter === "string" ? body.reporter.trim() : "";
    const caller = typeof body.caller === "string" ? body.caller.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "Description is too long (max 5000 chars)" }, { status: 400 });
    }

    const now = new Date();
    const { year, week } = seasonWeek(now);

    const doc = await getRulesDoc();
    const analysis = await analyzeIssueAgainstRules({
      docTitle: doc.title,
      docText: doc.text,
      issueDescription: description,
    });

    const issue: Issue = {
      id: newIssueId(),
      year,
      isoWeek: week,
      reportedAt: now.toISOString(),
      reporter,
      caller,
      description,
      aiStatus: analysis.status,
      aiRelatedSection: analysis.related_section,
      aiSuggestedWording: analysis.suggested_wording,
      status: analysis.status === "gap" ? "needs_rule_update" : "open",
      resolution: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await appendIssue(issue);
    return NextResponse.json({ issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Create issue error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
