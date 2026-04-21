import { google, sheets_v4 } from "googleapis";
import { Issue, ISSUE_HEADERS, issueToRow, rowToIssue } from "./issues";

const SHEET_NAME = "Issues";
const LAST_COL = "P"; // matches ISSUE_HEADERS length (16 columns)
const RANGE_ALL = `${SHEET_NAME}!A:${LAST_COL}`;
const RANGE_HEADERS = `${SHEET_NAME}!A1:${LAST_COL}1`;
const RANGE_ROWS = `${SHEET_NAME}!A2:${LAST_COL}`;

function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing Google OAuth env vars");
  }
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

function getClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function sheetId(): string {
  const id = process.env.GOOGLE_ISSUES_SHEET_ID;
  if (!id) throw new Error("GOOGLE_ISSUES_SHEET_ID is not set");
  return id;
}

let sheetReady = false;

async function ensureSheetExists(sheets: sheets_v4.Sheets): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId(),
    fields: "sheets.properties(title,sheetId)",
  });
  const tabs = meta.data.sheets ?? [];
  const has = tabs.some((s) => s.properties?.title === SHEET_NAME);
  if (has) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: SHEET_NAME },
          },
        },
      ],
    },
  });
}

async function ensureHeaders(sheets: sheets_v4.Sheets): Promise<void> {
  if (sheetReady) return;
  await ensureSheetExists(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: RANGE_HEADERS,
  });
  const existing = res.data.values?.[0] ?? [];
  const wanted = ISSUE_HEADERS as readonly string[];
  const match = existing.length === wanted.length && existing.every((v, i) => v === wanted[i]);
  if (!match) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: RANGE_HEADERS,
      valueInputOption: "RAW",
      requestBody: { values: [wanted as string[]] },
    });
  }
  sheetReady = true;
}

export async function appendIssue(issue: Issue): Promise<void> {
  const sheets = getClient();
  await ensureHeaders(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: RANGE_ALL,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [issueToRow(issue)] },
  });
}

export async function listIssues(): Promise<Issue[]> {
  const sheets = getClient();
  await ensureHeaders(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: RANGE_ROWS,
  });
  const rows = res.data.values ?? [];
  const issues: Issue[] = [];
  for (const row of rows) {
    const issue = rowToIssue(row as string[]);
    if (issue) issues.push(issue);
  }
  return issues;
}

async function findRowIndex(sheets: sheets_v4.Sheets, id: string): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `${SHEET_NAME}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => r[0] as string);
  const idx = ids.indexOf(id);
  return idx === -1 ? null : idx + 2; // +2 because range starts at row 2
}

export async function getIssue(id: string): Promise<Issue | null> {
  const issues = await listIssues();
  return issues.find((i) => i.id === id) ?? null;
}

// Column letters mirror ISSUE_HEADERS order (A = id, … , P = updated_at).
const COL: Record<keyof Issue, string> = {
  id: "A",
  year: "B",
  isoWeek: "C",
  tournament: "D",
  ground: "E",
  reportedAt: "F",
  reporter: "G",
  caller: "H",
  description: "I",
  aiStatus: "J",
  aiRelatedSection: "K",
  aiSuggestedWording: "L",
  status: "M",
  resolution: "N",
  createdAt: "O",
  updatedAt: "P",
};

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<Issue | null> {
  const sheets = getClient();
  await ensureHeaders(sheets);
  const rowIndex = await findRowIndex(sheets, id);
  if (!rowIndex) return null;

  const updatedAt = new Date().toISOString();
  const writes: { range: string; values: string[][] }[] = [];
  for (const key of Object.keys(patch) as (keyof Issue)[]) {
    if (key === "id") continue;
    const raw = patch[key];
    if (raw === undefined) continue;
    writes.push({
      range: `${SHEET_NAME}!${COL[key]}${rowIndex}`,
      values: [[String(raw)]],
    });
  }
  writes.push({
    range: `${SHEET_NAME}!${COL.updatedAt}${rowIndex}`,
    values: [[updatedAt]],
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { valueInputOption: "RAW", data: writes },
  });

  // Return a merged view without re-reading the sheet. Callers that need
  // the full issue body can still fetch getIssue explicitly.
  return { id, updatedAt, ...(patch as Partial<Issue>) } as Issue;
}
