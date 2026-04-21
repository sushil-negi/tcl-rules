import { NextResponse, after } from "next/server";
import { isAdmin } from "@/lib/auth";
import { appendIssue, listIssues, updateIssue } from "@/lib/sheets";
import { getRulesDoc } from "@/lib/google-doc";
import { analyzeIssueAgainstRules } from "@/lib/gemini";
import {
  Issue,
  seasonWeek,
  newIssueId,
  TOURNAMENTS,
  Tournament,
  GROUNDS,
  Ground,
} from "@/lib/issues";

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
      tournament?: unknown;
      ground?: unknown;
      team?: unknown;
    };
    const reporter = typeof body.reporter === "string" ? body.reporter.trim() : "";
    const caller = typeof body.caller === "string" ? body.caller.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const team = typeof body.team === "string" ? body.team.trim() : "";
    const tournamentRaw = typeof body.tournament === "string" ? body.tournament : "";
    const groundRaw = typeof body.ground === "string" ? body.ground : "";
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "Description is too long (max 5000 chars)" }, { status: 400 });
    }
    if (!TOURNAMENTS.includes(tournamentRaw as Tournament)) {
      return NextResponse.json({ error: "Tournament must be regular, seniors, or fireworks" }, { status: 400 });
    }
    if (!GROUNDS.includes(groundRaw as Ground)) {
      return NextResponse.json({ error: "Ground must be PHX, BOOT, WIL, LAD, or Other" }, { status: 400 });
    }
    const tournament = tournamentRaw as Tournament;
    const ground = groundRaw as Ground;

    const now = new Date();
    const { year, week } = seasonWeek(now, tournament);

    const issue: Issue = {
      id: newIssueId(),
      year,
      isoWeek: week,
      tournament,
      ground,
      team,
      reportedAt: now.toISOString(),
      reporter,
      caller,
      description,
      aiStatus: "analyzing",
      aiRelatedSection: "",
      aiSuggestedWording: "",
      status: "open",
      resolution: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await appendIssue(issue);

    // Run Gemini analysis AFTER the response is sent so the user isn't
    // blocked waiting 5-10 s for it. The detail page polls until the
    // aiStatus transitions out of "analyzing".
    after(async () => {
      try {
        const doc = await getRulesDoc();
        const analysis = await analyzeIssueAgainstRules({
          docTitle: doc.title,
          docText: doc.text,
          issueDescription: description,
        });
        await updateIssue(issue.id, {
          aiStatus: analysis.status,
          aiRelatedSection: analysis.related_section,
          aiSuggestedWording: analysis.suggested_wording,
          status: analysis.status === "gap" ? "needs_rule_update" : "open",
        });
      } catch (err) {
        console.error("Background analysis failed:", err);
        await updateIssue(issue.id, {
          aiStatus: "unclear",
          aiRelatedSection: "Automatic analysis failed — please review manually.",
        }).catch(() => {});
      }
    });

    return NextResponse.json({ issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Create issue error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
