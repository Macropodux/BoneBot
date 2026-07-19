// Reads a user-uploaded PDF (a DXA report or blood test) and extracts only
// the values BoneBot can use — never a diagnosis, never invented. This is
// pure extraction, not explanation: no clinical framing, just "what does
// this document say." SCREEN.md's guardrail applies here too — the caller
// must show the extracted value back to her for confirmation before using it.
//
// Degrades gracefully: no key -> 503 sentence, never a stack trace (see AGENTS.md).

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano";

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — a scanned report fits comfortably under this

// Ranges match docs/INPUT_SPEC.md, so an out-of-range extraction is dropped
// rather than silently trusted (likely a unit mismatch, e.g. ng/mL read as nmol/L).
const ExtractionSchema = z.object({
  documentType: z.enum(["dxa-report", "blood-test", "other", "unreadable"]),
  tScore: z.number().min(-5.0).max(3.0).nullable(),
  vitaminDNmolPerL: z.number().min(10).max(250).nullable(),
  calciumMmolPerL: z.number().min(1.5).max(3.5).nullable(),
  summary: z.string(),
});

const SYSTEM = `You read a medical document (a DXA/bone-density report or a blood test) and extract ONLY values that are explicitly printed on it. You never diagnose, interpret, or advise — a separate part of the app does that.

Rules:
- Extract a T-score only if the document states one explicitly (usually labelled "T-score", on the DXA/BMD clinical scale). If several are given (e.g. hip and spine), use the lowest (worst) one and say so in the summary.
- Extract vitamin D (25-OH-D) and serum calcium only if explicitly present. Convert to nmol/L and mmol/L if the document uses US units (vitamin D ng/mL x 2.5 = nmol/L; calcium mg/dL x 0.25 = mmol/L) and say you converted it in the summary.
- If a value is not clearly printed on the document, return null for it. Never estimate, guess, or carry over a value from your own knowledge.
- documentType: "dxa-report" if it's a bone-density/DXA scan report, "blood-test" if it's a lab panel, "other" if it's a real medical document but neither, "unreadable" if you cannot make out enough of it to extract anything.
- summary: 1-2 plain-language sentences a patient can read, stating exactly what you found (or didn't).`;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Document reading is unavailable: no API key configured.", { status: 503 });
  }

  let body: { pdfBase64?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Please send a valid request." }, { status: 400 });
  }

  if (!body.pdfBase64 || typeof body.pdfBase64 !== "string") {
    return Response.json({ error: "No PDF was attached." }, { status: 400 });
  }

  // Rough byte-size check on the base64 payload (base64 is ~4/3 the raw size).
  if (body.pdfBase64.length > (MAX_PDF_BYTES * 4) / 3) {
    return Response.json({ error: "That PDF is too large — please upload one under 8MB." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: openai(MODEL),
      schema: ExtractionSchema,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the values from this document, following the rules exactly." },
            { type: "file", data: body.pdfBase64, mediaType: "application/pdf" },
          ],
        },
      ],
    });
    return Response.json(object);
  } catch (e) {
    console.error("document extraction failed:", e);
    return new Response("BoneBot couldn't read that document right now.", { status: 503 });
  }
}
