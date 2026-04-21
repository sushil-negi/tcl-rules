import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getIssue, updateIssue } from "@/lib/sheets";
import { IssueStatus } from "@/lib/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES: IssueStatus[] = ["open", "resolved", "needs_rule_update"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      status?: unknown;
      resolution?: unknown;
    };

    const patch: { status?: IssueStatus; resolution?: string } = {};
    if (typeof body.status === "string") {
      if (!ALLOWED_STATUSES.includes(body.status as IssueStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status as IssueStatus;
    }
    if (typeof body.resolution === "string") {
      if (body.resolution.length > 5000) {
        return NextResponse.json({ error: "Resolution too long" }, { status: 400 });
      }
      patch.resolution = body.resolution;
    }

    const updated = await updateIssue(id, patch);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ issue: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
