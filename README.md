# TCL Rules Query

A lightweight web app that lets Tennis Cricket League members ask natural-language questions about the official league rules and get accurate, grounded answers in seconds. The app pulls the rules document live from Google Drive, sends its content plus the user's question to Google's Gemini LLM, and returns an answer strictly limited to what's written in the document — no hallucinations, no speculation.

---

## Features

- **Natural-language Q&A** over the official TCL rules Google Doc
- **Grounded answers** — Gemini is instructed to answer only from the document and to say "not specified" when information isn't there
- **Live data source** — the rules doc is pulled from Google Drive and auto-refreshes weekly
- **Manual refresh** — "Refresh rules & ask" button forces an immediate re-pull from Drive
- **Per-user history** — up to 50 prior Q&As stored in the user's browser (localStorage); collapsible, searchable, clickable to re-ask
- **Fully responsive** — works on phone, tablet, and desktop
- **No login required** — open team tool; usage is bounded by Gemini free/paid quota

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | React 19, TypeScript, [Tailwind CSS v4](https://tailwindcss.com) |
| Runtime | Node.js on Vercel serverless functions |
| Document source | Google Drive + Google Docs API via [`googleapis`](https://www.npmjs.com/package/googleapis) (OAuth 2.0, `drive.readonly` scope) |
| Document parsing | [`mammoth`](https://www.npmjs.com/package/mammoth) for `.docx` → plain text; native Drive export for Google Docs |
| LLM | [Google Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models) via [`@google/genai`](https://www.npmjs.com/package/@google/genai) |
| Caching | In-memory per serverless instance, 7-day TTL, invalidation endpoint |
| Client persistence | Browser `localStorage` (question history) |
| Hosting | [Vercel](https://vercel.com) with auto-deploy on push |

---

## Architecture

```
┌──────────────┐    POST /api/query    ┌───────────────────┐
│   Browser    │ ────────────────────▶ │   Next.js route   │
│ (page.tsx)   │                       │   handler         │
│              │ ◀──── JSON answer ─── │ (api/query)       │
└──────────────┘                       └─────────┬─────────┘
       │                                         │
       │ localStorage                            │
       │ (question history)                      ▼
       │                                  ┌────────────┐
       │                                  │ getRulesDoc│ ← 7-day in-memory cache
       │                                  └──────┬─────┘
       │                                         │ refresh_token (OAuth)
       │                                         ▼
       │                                  ┌────────────┐
       │                                  │ Google     │
       │                                  │ Drive API  │
       │                                  └────────────┘
       │                                         │
       │                                         ▼
       │                                  ┌────────────┐
       │                                  │ answerQ()  │
       │                                  │ (gemini.ts)│
       │                                  └──────┬─────┘
       │                                         │ API key
       │                                         ▼
       │                                  ┌────────────┐
       │                                  │ Gemini 2.5 │
       │                                  │ Flash API  │
       │                                  └────────────┘
```

### Why full-context, not RAG?

This app uses **full-context prompting** — the entire rules doc (~150k tokens) is sent to Gemini with every query. Gemini 2.5 Flash's 1M-token context window handles this comfortably.

We intentionally skipped RAG (chunking + embeddings + vector search) because:
- A single ~300-page document fits fully in context
- RAG adds infrastructure (vector DB, embedding pipeline) without quality gains at this size
- Full-context answers can cite any part of the doc, not just top-K retrieved chunks

If the corpus grows to many documents or exceeds ~800k tokens, migrating to RAG is the right move.

---

## Project Structure

```
tcl-rules/
├── public/
│   └── tcl-logo.png                  # TCL logo (header)
├── src/
│   ├── app/
│   │   ├── api/query/route.ts        # POST endpoint: question → answer
│   │   ├── globals.css               # Tailwind entrypoint
│   │   ├── layout.tsx                # Root layout + fonts
│   │   └── page.tsx                  # Single-page UI (form, history, answer)
│   └── lib/
│       ├── google-doc.ts             # Drive fetch + in-memory cache + .docx parsing
│       └── gemini.ts                 # Gemini API wrapper with grounded system prompt
├── .env.local.example                # Template for env vars (copy to .env.local)
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | API key for Gemini. Get from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | optional | Defaults to `gemini-2.5-flash`. Use `gemini-2.5-flash-lite` for lower cost |
| `GOOGLE_RULES_DOC_ID` | ✅ | The long ID in the rules Google Doc's URL (`docs.google.com/document/d/THIS_PART/edit`) |
| `GOOGLE_CLIENT_ID` | ✅ | OAuth 2.0 Client ID (Web application type) |
| `GOOGLE_CLIENT_SECRET` | ✅ | OAuth 2.0 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | ✅ | OAuth 2.0 Refresh Token with `drive.readonly` scope for the account that can read the Doc |
| `DOC_CACHE_TTL_SECONDS` | optional | Doc cache TTL. Defaults to `604800` (7 days). `0` disables caching |

Secrets live in `.env.local` (gitignored). In production, they are set in the Vercel project's Environment Variables.

---

## Local Development

### 1. Install

```bash
cd tcl-rules
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the six required values (see table above). If you don't yet have a `GOOGLE_REFRESH_TOKEN` with `drive.readonly` scope, use Google's [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
1. Gear icon → **Use your own OAuth credentials** → paste `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
2. Step 1 scope list → check `https://www.googleapis.com/auth/drive.readonly` under Drive API v3
3. Authorize → exchange code for tokens → copy the refresh token

Make sure the OAuth client has `https://developers.google.com/oauthplayground` in its **Authorized redirect URIs** in the GCP Console.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build

```bash
npm run build
npm start
```

---

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Next.js** (auto-detected)
4. Add all six environment variables from `.env.local`
5. Deploy

Every push to `main` triggers an automatic redeploy. Preview branches get their own preview URLs.

### Custom domain (subdomain)

In your Vercel project → **Settings → Domains** → add e.g. `rules.tenniscricketleague.com`. Then at your DNS provider add:

```
rules  CNAME  cname.vercel-dns.com
```

Vercel auto-issues SSL within ~5 minutes.

### Serverless behavior

- The route handler runs on Node.js serverless functions
- The doc cache is **per-instance, in-memory**: each cold-started instance fetches the doc once, caches for up to 7 days, then expires
- Drive API calls on cold starts are free and fast (~1–2 s)
- If you want a truly shared cache across all instances, swap the in-memory Map in `src/lib/google-doc.ts` for Vercel KV or Upstash Redis

---

## Cost

Gemini 2.5 Flash pricing (as of April 2026):
- Input: ~$0.30 per 1M tokens
- Output: ~$2.50 per 1M tokens
- A typical query = full 150k-token doc + short answer ≈ **$0.05 per query**

Example monthly cost for a team:
- 100 questions/day → ~$1.50/day → **~$45/month**
- Free tier (on a personal Gemini key): 1,500 queries/day

Drive API calls are free. Vercel's hobby tier covers a team-sized deployment at $0.

To reduce cost, set `GEMINI_MODEL=gemini-2.5-flash-lite` in env vars — roughly 1/3 the price at slightly lower quality.

---

## Security

- `.env.local` is gitignored; never commit secrets
- The app has **no authentication** — anyone with the URL can query. If you need to restrict access, the simplest option is Vercel's built-in password protection or a shared-secret header check in `src/app/api/query/route.ts`
- The OAuth refresh token has read-only Drive scope, limiting blast radius if leaked
- All traffic is HTTPS via Vercel's auto-issued SSL

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `File not found` on query | Doc not shared with the OAuth account | Share the Doc with `support@tenniscricketleague.com` as Viewer |
| `Google Drive API has not been used` | API disabled in the project | Enable it in the GCP Console for the project holding the OAuth client |
| `Quota exceeded, limit: 0` | API key in a project without free-tier access (org policy) | Create a new Gemini key in AI Studio with a personal account, or enable billing |
| `redirect_uri_mismatch` when getting refresh token | OAuth client doesn't whitelist the Playground URI | Add `https://developers.google.com/oauthplayground` to **Authorized redirect URIs** |
| `insufficient authentication scopes` | Refresh token missing `drive.readonly` | Re-run OAuth Playground with the correct scope checked |

---

## License

Private / internal to Tennis Cricket League.
