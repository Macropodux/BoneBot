import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("../lib/bone-model.ts", import.meta.url), "utf8");

describe("landing and questionnaire copy", () => {
  it("uses clear landing language and removes superseded claims", () => {
    expect(page).toContain("Know your bone fracture risk{\" \"}");
    expect(page).toContain(">before</em> you break something.");
    expect(page).toContain("Three minutes. An NHANES-trained model does the maths. AI turns the result into plain English.");
    expect(page).toContain("Designed around bone changes after menopause. A bone-health tool built with women in mind.");
    expect(page).toContain(
      '{ num: "03", title: "The AI explains", body: "The AI only puts that result into plain English. It never sets or changes your score." }',
    );
    expect(page).not.toContain("bone fraction risk");
    expect(page).not.toContain("Most bone-health research and tools were built around men");
    expect(page).not.toContain("How active are you day-to-day");
  });

  it("keeps the condition question faithful to the trained feature", () => {
    expect(page).not.toContain("coeliac disease");
    expect(model).toContain("Thyroid or chronic kidney disease");
  });
});
