# Ambiguous Intake Answer Design

## Goal

Keep BoneBot’s questionnaire moving when a person gives an ambiguous answer, without converting uncertainty into an assumed clinical risk factor.

## Scope

This applies to the server-owned intake flow in `src/lib/intake-schema.ts` and the matching client conversation. It covers yes/no questions, numeric questions, years, and menopause status. It does not change the trained coefficients, triage threshold, or final T-score formula.

## Interaction

1. When a response cannot be confidently parsed, ask one question-specific clarification.
2. If the clarification is also ambiguous, record that field as `unknown`.
3. Continue the assessment using the model’s documented neutral/default value for that field.
4. Include a result note naming every field that used a default because the answer remained uncertain.

For example, a possible fragility fracture triggers: “Was the break from a minor fall or low-impact injury, rather than a major accident?” If uncertainty remains, the model receives its existing neutral default (no positive fracture contribution) and the result explains that the fracture history was uncertain and should be discussed with a clinician.

## Data model

Each uncertain field is stored separately from its typed model value. The value supplied to the model remains the existing type (`boolean` or `number`) so the deterministic scorer needs no new branches. An `uncertainFields` collection preserves provenance for the result notes.

For numeric answers, an unresolved ambiguity uses the already exported model imputation default where available. For required direct-measure fields that lack a defensible model default (height and weight), the flow continues only after recording the field as unknown and uses the same documented population defaults used by the generated model artifact.

## Safety and communication

The app must never describe an unknown answer as “No,” and it must never claim that a default represents the person’s true medical history. The final note must say that uncertainty can affect the estimate and that the person can discuss the uncertain factor with a clinician.

## Acceptance criteria

- Every ambiguous response gets one clarification before any default is used.
- A second ambiguous answer does not block the assessment.
- Unknown values do not receive the positive coefficient of a risk factor.
- Final results disclose each defaulted unknown field.
- Existing unambiguous questionnaire paths retain their current output.
