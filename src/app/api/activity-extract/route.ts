// BoneBot — wearable/activity-app screenshot extraction. Mirrors
// blood-results/route.ts: the vision model only extracts what's plainly
// visible (steps, active minutes) per image; it never decides the
// weightBearingActivity score. That mapping is a small deterministic
// function below (mapToActivityLevel) — plain arithmetic, not a model call —
// and the client re-validates/confirms before the value ever reaches
// mapAnswersToFeatures()/scoreBone(). See AGENTS.md: the model predicts, the
// LLM only extracts or explains.

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
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
  // 0..1 — deterministic mapping, see mapToActivityLevel(). Not model-decided.
  weightBearingActivity: number | null;
};

function boundedOrNull(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

function sanitize(raw: RawActivity): ActivityImageExtraction {
  return {
    estimatedSteps: boundedOrNull(raw.estimatedSteps, 0, 60000),
    estimatedActiveMinutes: boundedOrNull(raw.estimatedActiveMinutes, 0, 1440),
  };
}

// Deterministic, illustrative mapping from raw daily activity signals to the
// model's 0..1 weightBearingActivity input — same spirit as page.tsx's
// ACTIVITY_LEVEL_MAP for the Low/Moderate/High chip. 10,000 steps/day and 45
// active minutes/day are treated as saturating ("High") signals; when both
// are present they're averaged.
function mapToActivityLevel(steps: number | null, minutes: number | null): number | null {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const stepsScore = steps !== null ? clamp01(steps / 10000) : null;
  const minutesScore = minutes !== null ? clamp01(minutes / 45) : null;
  const scores = [stepsScore, minutesScore].filter((s): s is number => s !== null);
  if (!scores.length) return null;
  return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100;
}

// Deterministic aggregate across up to MAX_IMAGES screenshots (e.g. today's
// summary plus a weekly-average screen): average of whichever signal is
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
              "You extract a single day's activity summary from a screenshot of a fitness tracker, smartwatch, or activity app (e.g. Apple Health, Fitbit, Garmin, Google Fit). Extract only values clearly visible. Do not estimate, interpret, diagnose, or give advice. Return null for a missing or unclear value.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract only: total steps for the day, and total active/exercise minutes for the day. Return null for anything not clearly shown.",
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
        { error: "BoneBot could not read those images. You can still choose Low, Moderate, or High." },
        { status: 422 },
      );
    }

    const merged = mergeActivityExtractions(successful);
    const result: ActivityExtractResult = {
      ...merged,
      weightBearingActivity: mapToActivityLevel(merged.estimatedSteps, merged.estimatedActiveMinutes),
    };
    return Response.json(result);
  } catch (error) {
    console.error("activity extraction failed:", error);
    return Response.json(
      { error: "BoneBot could not read those images. You can still choose Low, Moderate, or High." },
      { status: 422 },
    );
  }
}
