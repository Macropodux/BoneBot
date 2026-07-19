import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const BloodResultsSchema = z.object({
  vitaminD: z.number().min(10).max(250).nullable(),
  calcium: z.number().min(1.5).max(3.5).nullable(),
  alkalinePhosphatase: z.number().min(20).max(400).nullable(),
  redBloodCellCount: z.number().min(2.5).max(7).nullable(),
});

export type BloodResults = z.infer<typeof BloodResultsSchema>;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "BoneBot is unavailable: no API key configured." }, { status: 503 });
  }

  const formData = await req.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || !ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "Upload a JPG, PNG, or WebP blood-result image smaller than 5 MB." },
      { status: 400 },
    );
  }

  try {
    const { object } = await generateObject({
      model: openai(MODEL),
      schema: BloodResultsSchema,
      system:
        "You extract laboratory values from an uploaded blood-result image. Extract only values that are clearly visible with the exact labels and units below. Do not estimate, convert units, interpret, diagnose, or give advice. Return null for a missing, unclear, differently-unit-ed, or out-of-range value.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract only: vitamin D in nmol/L, calcium in mmol/L, alkaline phosphatase in U/L, and red blood cell count in 10^12/L. Return null for every other measurement.",
            },
            { type: "image", image: new Uint8Array(await image.arrayBuffer()), mediaType: image.type },
          ],
        },
      ],
    });
    return Response.json(object);
  } catch (error) {
    console.error("blood-result extraction failed:", error);
    return Response.json({ error: "BoneBot could not read that image. Please type the values instead." }, { status: 422 });
  }
}
