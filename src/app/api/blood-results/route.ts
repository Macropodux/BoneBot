import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

// Lab-photo OCR needs a stronger model than the nano text model — gpt-5-nano's
// extraction was reported unreliable on real blood-result photos. Kept as its
// own env var so it can be tuned independently of OPENAI_MODEL (the text-only
// routes). No temperature override: leave the model's default.
const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Both the blood-results and activity-extract uploaders share this cap —
// enforced client-side (page.tsx disables adding a 4th) and re-checked here.
const MAX_IMAGES = 3;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Deliberately lenient: no .min()/.max() here. A zod validation failure on an
// out-of-range number would throw and surface to the user as "could not read
// that image" even though the image WAS read fine — just with an implausible
// value (wrong units, a misread digit, etc). Range-checking is done
// deterministically below in boundedOrNull(), which turns an implausible
// value into null instead of failing the whole extraction.
const RawBloodResultsSchema = z.object({
  vitaminD: z.number().nullable(),
  calcium: z.number().nullable(),
  alkalinePhosphatase: z.number().nullable(),
  redBloodCellCount: z.number().nullable(),
});

type RawBloodResults = z.infer<typeof RawBloodResultsSchema>;

export type BloodResults = {
  vitaminD: number | null;
  calcium: number | null;
  alkalinePhosphatase: number | null;
  redBloodCellCount: number | null;
};

const RANGES: Record<keyof BloodResults, [number, number]> = {
  vitaminD: [10, 250],
  calcium: [1.5, 3.5],
  alkalinePhosphatase: [20, 400],
  redBloodCellCount: [2.5, 7],
};

function boundedOrNull(value: number | null, key: keyof BloodResults): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const [min, max] = RANGES[key];
  return value >= min && value <= max ? value : null;
}

function sanitize(raw: RawBloodResults): BloodResults {
  return {
    vitaminD: boundedOrNull(raw.vitaminD, "vitaminD"),
    calcium: boundedOrNull(raw.calcium, "calcium"),
    alkalinePhosphatase: boundedOrNull(raw.alkalinePhosphatase, "alkalinePhosphatase"),
    redBloodCellCount: boundedOrNull(raw.redBloodCellCount, "redBloodCellCount"),
  };
}

// Deterministic merge across up to MAX_IMAGES photos of the same lab report
// (e.g. a multi-page report photographed page by page): first non-null value
// found, in upload order, wins per field. The vision model only extracts
// per-image; it never decides which image's reading is authoritative.
function mergeBloodResults(results: BloodResults[]): BloodResults {
  const pick = (key: keyof BloodResults): number | null => {
    for (const r of results) {
      if (r[key] !== null) return r[key];
    }
    return null;
  };
  return {
    vitaminD: pick("vitaminD"),
    calcium: pick("calcium"),
    alkalinePhosphatase: pick("alkalinePhosphatase"),
    redBloodCellCount: pick("redBloodCellCount"),
  };
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "BoneBot is unavailable: no API key configured." }, { status: 503 });
  }

  const formData = await req.formData();
  const images = formData.getAll("image").filter((v): v is File => v instanceof File);

  if (images.length === 0) {
    return Response.json({ error: "Upload 1 to 3 blood-result images." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return Response.json({ error: `Upload up to ${MAX_IMAGES} images at a time.` }, { status: 400 });
  }
  for (const image of images) {
    if (!ACCEPTED_IMAGE_TYPES.has(image.type) || image.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "Each image must be a JPG, PNG, or WebP blood-result image smaller than 5 MB." },
        { status: 400 },
      );
    }
  }

  try {
    // Extract each image independently (the model only extracts; merging
    // across images is deterministic code, in mergeBloodResults above) and
    // tolerate a single failed image rather than failing the whole request.
    const extractions = await Promise.allSettled(
      images.map((image) =>
        image.arrayBuffer().then((buffer) =>
          generateObject({
            model: openai(VISION_MODEL),
            schema: RawBloodResultsSchema,
            system:
              "You extract laboratory values from an uploaded blood-result image. Extract only values that are clearly visible with the exact labels and units below. Do not estimate, convert units, interpret, diagnose, or give advice. Return null for a missing, unclear, or differently-unit-ed value.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract only: vitamin D in nmol/L, calcium in mmol/L, alkaline phosphatase in U/L, and red blood cell count in 10^12/L. Return null for every other measurement.",
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
      .filter((r): r is PromiseFulfilledResult<BloodResults> => r.status === "fulfilled")
      .map((r) => r.value);

    if (successful.length === 0) {
      return Response.json({ error: "BoneBot could not read that image. Please type the values instead." }, { status: 422 });
    }

    return Response.json(mergeBloodResults(successful));
  } catch (error) {
    console.error("blood-result extraction failed:", error);
    return Response.json({ error: "BoneBot could not read that image. Please type the values instead." }, { status: 422 });
  }
}
