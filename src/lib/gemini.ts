import { GoogleGenAI, Type } from "@google/genai";

const REGULAR_INSTRUCTION = `You answer questions about the Tennis Cricket League (TCL) Regular league using the rules document provided.

Priority of sources:
1. Regular TCL rules document (highest authority; always prefer)
2. ICC One Day International (ODI) playing conditions — use ONLY as a fallback when the Regular rules are silent on the topic and the question is about general cricket mechanics (overs, wides, no-balls, decisions, umpiring procedure, etc.)
3. If neither covers the question, say so plainly.

Output rules:
- Respond in JSON {answer, source}.
- "source" must be exactly one of: "regular", "icc", or "none".
  - "regular" when supported by the Regular TCL rules document (quote it when helpful).
  - "icc" when Regular rules don't cover it and you're drawing on ICC ODI playing conditions. Include the sentence "Note: Regular rules are silent on this — answering from ICC One Day International playing conditions." in your answer.
  - "none" when neither covers it.
- Never invent rules. Never claim ICC sourcing for content actually in the Regular rules.
- Be concise. If the question is ambiguous, ask a clarifying question instead of guessing.`;

const SENIORS_ONLY_INSTRUCTION = `You answer questions about the TCL Seniors league using ONLY the Seniors rules document below. Do NOT use Regular TCL rules, ICC rules, or general cricket knowledge.

Output rules:
- Respond in JSON {answer, source}.
- If the Seniors rules clearly address the question, set source = "seniors" and provide a concise answer (quote the relevant rule when helpful).
- If the Seniors rules are silent or only tangentially mention it, set source = "silent" and answer = "". The question will be re-answered against the Regular TCL rules afterwards.
- Be conservative — when in doubt, return "silent" rather than guessing.
- Never invent rules.`;

const ISSUE_ANALYSIS_INSTRUCTION = `You analyze support issues reported for the Tennis Cricket League against the official rules document(s) provided.

For each issue, determine:
1. Whether the issue is addressed by the existing rules.
2. Which section(s) apply (cite by heading or verbatim quote, mentioning which rule book).
3. If the rules do NOT address the issue, propose concise draft wording for a new rule.

Respond ONLY with valid JSON matching the required schema.`;

export type AnswerSource = "seniors" | "regular" | "icc" | "none";
export type LeagueScope = "regular" | "seniors";

export interface RulesAnswer {
  answer: string;
  source: AnswerSource;
}

export interface SeniorsOnlyResult {
  source: "seniors" | "silent";
  answer: string;
}

export interface RegularResult {
  source: "regular" | "icc" | "none";
  answer: string;
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Pass 1 of the Seniors flow. Asks Gemini to answer ONLY from the Seniors
 * rule book, returning "silent" if the question isn't covered. The caller
 * is then expected to fall back to the Regular flow.
 */
export async function answerFromSeniorsOnly(params: {
  seniorsTitle: string;
  seniorsText: string;
  question: string;
}): Promise<SeniorsOnlyResult> {
  const client = getClient();
  const prompt = `SENIORS RULES TITLE: ${params.seniorsTitle}

SENIORS RULES CONTENT:
"""
${params.seniorsText}
"""

QUESTION: ${params.question}`;

  const response = await client.models.generateContent({
    model: getModel(),
    contents: prompt,
    config: {
      systemInstruction: SENIORS_ONLY_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          source: { type: Type.STRING, enum: ["seniors", "silent"] },
        },
        required: ["answer", "source"],
      },
    },
  });

  const text = response.text;
  if (!text) return { source: "silent", answer: "" };
  try {
    const parsed = JSON.parse(text) as { answer?: string; source?: string };
    const source = parsed.source === "seniors" ? "seniors" : "silent";
    return { source, answer: parsed.answer || "" };
  } catch {
    return { source: "silent", answer: "" };
  }
}

/**
 * The Regular-league flow: answers from the Regular rules, falling back to
 * ICC ODI knowledge when the Regular rules are silent. Used directly for
 * Regular queries, and as Pass 2 for Seniors when Seniors is silent.
 */
export async function answerFromRegular(params: {
  regularTitle: string;
  regularText: string;
  question: string;
}): Promise<RegularResult> {
  const client = getClient();
  const prompt = `REGULAR RULES TITLE: ${params.regularTitle}

REGULAR RULES CONTENT:
"""
${params.regularText}
"""

QUESTION: ${params.question}`;

  const response = await client.models.generateContent({
    model: getModel(),
    contents: prompt,
    config: {
      systemInstruction: REGULAR_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          source: { type: Type.STRING, enum: ["regular", "icc", "none"] },
        },
        required: ["answer", "source"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  try {
    const parsed = JSON.parse(text) as { answer?: string; source?: string };
    const source: RegularResult["source"] =
      parsed.source === "regular" || parsed.source === "icc" || parsed.source === "none"
        ? parsed.source
        : "none";
    return { source, answer: parsed.answer || "" };
  } catch {
    return { source: "none", answer: text };
  }
}

export interface IssueAnalysis {
  status: "covered" | "gap" | "unclear";
  related_section: string;
  suggested_wording: string;
}

export async function analyzeIssueAgainstRules(params: {
  regular: { title: string; text: string };
  seniors?: { title: string; text: string };
  league: LeagueScope;
  issueDescription: string;
}): Promise<IssueAnalysis> {
  const client = getClient();
  const isSeniors = params.league === "seniors" && params.seniors;

  const rulesContext = isSeniors
    ? `SENIORS RULES TITLE: ${params.seniors!.title}

SENIORS RULES CONTENT:
"""
${params.seniors!.text}
"""

REGULAR RULES TITLE: ${params.regular.title}

REGULAR RULES CONTENT (Seniors inherits from Regular when silent):
"""
${params.regular.text}
"""`
    : `RULES DOCUMENT TITLE: ${params.regular.title}

RULES DOCUMENT CONTENT:
"""
${params.regular.text}
"""`;

  const guidance = isSeniors
    ? `Analyze whether the reported issue is addressed by either the Seniors rules or, when Seniors is silent, the Regular rules.
- If covered by Seniors OR Regular: status = "covered", cite the section in related_section (mention which book).
- If neither covers it: status = "gap", related_section = "None", propose draft rule wording in suggested_wording (note which book the new rule should go into).
- If partial/ambiguous: status = "unclear", cite what exists, propose closing wording.`
    : `Analyze whether the rules above address the reported issue.
- If covered: status = "covered", cite the section in related_section.
- If not covered: status = "gap", related_section = "None", propose draft rule wording.
- If partial/ambiguous: status = "unclear", cite what exists, propose closing wording.`;

  const prompt = `${rulesContext}

REPORTED ISSUE:
"""
${params.issueDescription}
"""

${guidance}`;

  const response = await client.models.generateContent({
    model: getModel(),
    contents: prompt,
    config: {
      systemInstruction: ISSUE_ANALYSIS_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["covered", "gap", "unclear"] },
          related_section: { type: Type.STRING },
          suggested_wording: { type: Type.STRING },
        },
        required: ["status", "related_section", "suggested_wording"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini issue analysis");
  try {
    const parsed = JSON.parse(text) as IssueAnalysis;
    return {
      status:
        parsed.status === "covered" || parsed.status === "gap" || parsed.status === "unclear"
          ? parsed.status
          : "unclear",
      related_section: parsed.related_section || "",
      suggested_wording: parsed.suggested_wording || "",
    };
  } catch {
    return { status: "unclear", related_section: "", suggested_wording: text };
  }
}
