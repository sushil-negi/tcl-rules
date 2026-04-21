import { google } from "googleapis";
import mammoth from "mammoth";

function getAuth() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Missing Google OAuth env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)"
    );
  }
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

const NATIVE_DOC_MIME = "application/vnd.google-apps.document";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function fetchDocText(fileId: string): Promise<{ text: string; title: string }> {
  const drive = google.drive({ version: "v3", auth: getAuth() });

  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
  });
  const mimeType = meta.data.mimeType ?? "";
  const title = meta.data.name ?? "Rules";

  if (mimeType === NATIVE_DOC_MIME) {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return { text: String(res.data), title };
  }

  if (mimeType === DOCX_MIME) {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, title };
  }

  if (mimeType === "text/plain") {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    return { text: String(res.data), title };
  }

  throw new Error(
    `Unsupported file type "${mimeType}" for doc "${title}". Expected a Google Doc, .docx, or .txt.`
  );
}

type CacheEntry = { text: string; title: string; fetchedAt: number };
let cache: CacheEntry | null = null;

function ttlMs(): number {
  const defaultSeconds = 7 * 24 * 60 * 60; // 1 week
  const s = Number(process.env.DOC_CACHE_TTL_SECONDS ?? defaultSeconds);
  return (Number.isFinite(s) && s > 0 ? s : defaultSeconds) * 1000;
}

export async function getRulesDoc(): Promise<CacheEntry> {
  const docId = process.env.GOOGLE_RULES_DOC_ID;
  if (!docId) throw new Error("GOOGLE_RULES_DOC_ID is not set");

  if (cache && Date.now() - cache.fetchedAt < ttlMs()) return cache;

  const { text, title } = await fetchDocText(docId);
  cache = { text, title, fetchedAt: Date.now() };
  return cache;
}

export function invalidateRulesCache(): void {
  cache = null;
}
