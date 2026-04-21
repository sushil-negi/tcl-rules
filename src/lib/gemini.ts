import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are an assistant that answers questions strictly about the TCL rules document provided below.

Rules for your answers:
- Only use information contained in the provided document. If the answer is not in the document, say so plainly — do not speculate.
- Quote the relevant rule wording when helpful.
- Be concise. Prefer short, direct answers over long explanations unless the user asks for detail.
- If a question is ambiguous, ask a clarifying question instead of guessing.`;

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
