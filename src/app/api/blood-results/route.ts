import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 30;

// Lab-photo OCR needs a stronger model than the nano text model — gpt-5-nano's
// extraction was reported unreliable on real blood-result photos. Kept as its
// own env var so it can be tuned independently of OPENAI_MODEL (the text-only
// routes). No temperature override: leave the model's default.
const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";
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
const UnitValueSchema = z
  .object({
    value: z.number().describe("the numeric result exactly as printed"),
    unit: z
      .string()
      .describe(
        "the unit exactly as printed on the report, e.g. 'nmol/L', 'ng/mL', 'mmol/L', 'mg/dL'; empty string if none is printed",
      ),
  })
  .nullable();

const RawBloodResultsSchema = z.object({
  vitaminD: UnitValueSchema,
  calcium: UnitValueSchema,
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

const round1 = (n: number) => Math.round(n * 10) / 10;

// 25-OH vitamin D: ng/mL -> nmol/L is ×2.496. Anything else (nmol/L, or no
// printed unit) is taken as already in nmol/L.
function vitaminDToNmolL(uv: { value: number; unit: string } | null): number | null {
  if (!uv || !Number.isFinite(uv.value)) return null;
  const u = uv.unit.toLowerCase();
  return round1(u.includes("ng") ? uv.value * 2.496 : uv.value);
}

// Serum calcium: mg/dL -> mmol/L is ÷4.008. Anything else (mmol/L, or no
// printed unit) is taken as already in mmol/L.
function calciumToMmolL(uv: { value: number; unit: string } | null): number | null {
  if (!uv || !Number.isFinite(uv.value)) return null;
  const u = uv.unit.toLowerCase();
  return round1(u.includes("mg") ? uv.value / 4.008 : uv.value);
}

function sanitize(raw: RawBloodResults): BloodResults {
  return {
    vitaminD: boundedOrNull(vitaminDToNmolL(raw.vitaminD), "vitaminD"),
    calcium: boundedOrNull(calciumToMmolL(raw.calcium), "calcium"),
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
              "You extract laboratory values from an uploaded blood-result image. Report each value's NUMBER exactly as printed and its UNIT exactly as printed — do NOT convert, estimate, interpret, diagnose, or advise. Recognise common label variants: vitamin D includes 'Vitamin D', 'Vit D', 'Vit. D', '25-OH Vitamin D', '25-hydroxyvitamin D', '25(OH)D', 'Vitamin D3', 'cholecalciferol', 'calcidiol'; calcium includes 'Calcium', 'Ca', 'Serum calcium', 'Total calcium', 'Corrected calcium'. If a value is not clearly present, return null for it.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "From this blood report, extract: vitamin D (25-OH vitamin D / Vit D / Vitamin D3 — any variant), calcium (serum/total/corrected), alkaline phosphatase, and red blood cell count. For vitamin D and calcium, give both the number as printed AND its unit as printed (e.g. value 30, unit 'ng/mL'; or value 75, unit 'nmol/L') — never convert. Return null for anything not clearly shown.",
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
