import { IntakeAnswersSchema, nextIntakeStep } from "@/lib/intake-schema";

export const maxDuration = 10;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Please send a valid intake response." }, { status: 400 });
  }

  const parsed = IntakeAnswersSchema.safeParse(
    typeof body === "object" && body !== null && "answers" in body
      ? (body as { answers: unknown }).answers
      : undefined,
  );

  if (!parsed.success) {
    return Response.json(
      { error: "One of those answers was not in a format BoneBot can use." },
      { status: 400 },
    );
  }

  return Response.json(nextIntakeStep(parsed.data));
}
