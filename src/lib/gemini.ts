import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are an assistant that answers questions strictly about the TCL rules document provided below.

Rules for your answers:
- Only use information contained in the provided document. If the answer is not in the document, say so plainly — do not speculate.
- Quote the relevant rule wording when helpful.
- Be concise. Prefer short, direct answers over long explanations unless the user asks for detail.
- If a question is ambiguous, ask a clarifying question instead of guessing.`;

const ISSUE_ANALYSIS_INSTRUCTION = `You analyze support issues reported for the Tennis Cricket League against the official rules document.

For each issue, determine:
1. Whether the issue is addressed by the existing rules document.
2. Which section(s) of the rules apply (cite by heading or verbatim quote).
3. If the rules do NOT address the issue, propose concise draft wording for a new rule that would cover it.

Respond ONLY with valid JSON matching the required schema. Do not include any prose outside the JSON.`;

export async function answerQuestion(params: {
  question: string;
  docTitle: string;
  docText: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `DOCUMENT TITLE: ${params.docTitle}

DOCUMENT CONTENT:
"""
${params.docText}
"""

QUESTION: ${params.question}`;

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export interface IssueAnalysis {
  status: "covered" | "gap" | "unclear";
  related_section: string;
  suggested_wording: string;
}

export async function analyzeIssueAgainstRules(params: {
  docTitle: string;
  docText: string;
  issueDescription: string;
}): Promise<IssueAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `RULES DOCUMENT TITLE: ${params.docTitle}

RULES DOCUMENT CONTENT:
"""
${params.docText}
"""

REPORTED ISSUE:
"""
${params.issueDescription}
"""

Analyze whether the issue is addressed by the rules above.
- If the rules clearly cover this situation, set status = "covered", cite the relevant section in related_section, and leave suggested_wording empty.
- If the rules do NOT cover it, set status = "gap", leave related_section empty or put "None", and propose concise draft rule wording (1-3 sentences) in suggested_wording.
- If partially covered or ambiguous, set status = "unclear", cite what exists in related_section, and propose wording that would close the gap in suggested_wording.`;

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: ISSUE_ANALYSIS_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            enum: ["covered", "gap", "unclear"],
          },
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
      status: parsed.status === "covered" || parsed.status === "gap" || parsed.status === "unclear" ? parsed.status : "unclear",
      related_section: parsed.related_section || "",
      suggested_wording: parsed.suggested_wording || "",
    };
  } catch {
    return { status: "unclear", related_section: "", suggested_wording: text };
  }
}
