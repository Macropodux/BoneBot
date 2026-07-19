// BoneBot — wearable/activity-app screenshot extraction. Mirrors
// blood-results/route.ts: the vision model only extracts what's plainly
// visible (steps, active minutes) per image; it never decides the
// weightBearingActivity score. That mapping is a small deterministic
// function in activity-input.ts — plain arithmetic, not a model call —
// and the client re-validates/confirms before the value ever reaches
// mapAnswersToFeatures()/scoreBone(). See AGENTS.md: the model predicts, the
// LLM only extracts or explains.

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { activityLevelFromDailyAverages } from "@/lib/activity-input";

export const maxDuration = 30;

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Shared cap with blood-results/route.ts — enforced client-side (page.tsx
// disables adding a 4th) and re-checked here.
const MAX_IMAGES = 3;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Deliberately lenient — see blood-results/route.ts for why: no .min()/.max()
// on the schema, so an implausible number doesn't throw and surface as
// "could not read that image". boundedOrNull() below turns it into null
// instead.
const RawActivitySchema = z.object({
  estimatedSteps: z.number().nullable(),
  estimatedActiveMinutes: z.number().nullable(),
});

type RawActivity = z.infer<typeof RawActivitySchema>;

type ActivityImageExtraction = {
  estimatedSteps: number | null;
  estimatedActiveMinutes: number | null;
};

export type ActivityExtractResult = {
  estimatedSteps: number | null;
  estimatedActiveMinutes: number | null;
  // 0..1 — deterministic mapping, see activity-input.ts. Not model-decided.
  weightBearingActivity: number | null;
};

function boundedOrNull(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

function sanitize(raw: RawActivity): ActivityImageExtraction {
  return {
    estimatedSteps: boundedOrNull(raw.estimatedSteps, 0, 100000),
    estimatedActiveMinutes: boundedOrNull(raw.estimatedActiveMinutes, 0, 1440),
  };
}

// Deterministic aggregate across up to MAX_IMAGES screenshots (e.g. separate
// weekly-average screens): average of whichever signal is
// present across images. The vision model only extracts per-image; merging
// is plain code, never model-decided.
function mergeActivityExtractions(results: ActivityImageExtraction[]): ActivityImageExtraction {
  const avg = (values: number[]): number | null =>
    values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
  const steps = results.map((r) => r.estimatedSteps).filter((v): v is number => v !== null);
  const minutes = results.map((r) => r.estimatedActiveMinutes).filter((v): v is number => v !== null);
  return { estimatedSteps: avg(steps), estimatedActiveMinutes: avg(minutes) };
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "BoneBot is unavailable: no API key configured." }, { status: 503 });
  }

  const formData = await req.formData();
  const images = formData.getAll("image").filter((v): v is File => v instanceof File);

  if (images.length === 0) {
    return Response.json({ error: "Upload 1 to 3 activity-app or watch screenshots." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return Response.json({ error: `Upload up to ${MAX_IMAGES} images at a time.` }, { status: 400 });
  }
  for (const image of images) {
    if (!ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "Each image must be JPG, PNG, or WebP and smaller than 5 MB." },
        { status: 400 },
      );
    }
  }

  try {
    const extractions = await Promise.allSettled(
      images.map((image) =>
        image.arrayBuffer().then((buffer) =>
          generateObject({
            model: openai(VISION_MODEL),
            schema: RawActivitySchema,
            system:
              "You extract average daily activity values from a weekly summary screenshot of a fitness tracker, smartwatch, or activity app (e.g. Apple Health, Fitbit, Garmin, Google Fit). Extract only averages clearly visible. Do not estimate, calculate from totals, interpret, diagnose, or give advice. Return null for a missing or unclear value.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract only: average steps per day, and average active/exercise minutes per day for the displayed period. Return null for anything not clearly shown as an average.",
                  },
                  { type: "file", data: new Uint8Array(buffer), mediaType: image.type },
                ],
              },
            ],
          }).then((r) => sanitize(r.object)),
        ),
      ),
    );

    const successful = extractions
      .filter((r): r is PromiseFulfilledResult<ActivityImageExtraction> => r.status === "fulfilled")
      .map((r) => r.value);

    if (successful.length === 0) {
      return Response.json(
        { error: "BoneBot could not read those images. You can still enter your daily averages manually." },
        { status: 422 },
      );
    }

    const merged = mergeActivityExtractions(successful);
    const result: ActivityExtractResult = {
      ...merged,
      weightBearingActivity: activityLevelFromDailyAverages(merged.estimatedSteps, merged.estimatedActiveMinutes),
    };
    return Response.json(result);
  } catch (error) {
    console.error("activity extraction failed:", error);
    return Response.json(
      { error: "BoneBot could not read those images. You can still enter your daily averages manually." },
      { status: 422 },
    );
  }
}
