import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FLOATING_BONES } from "./FloatingBones";

describe("FloatingBones", () => {
  it("defines a deterministic, restrained landing-page motif", () => {
    expect(FLOATING_BONES).toHaveLength(9);
    expect(new Set(FLOATING_BONES.map((bone) => bone.id)).size).toBe(9);
    expect(FLOATING_BONES.every((bone) => bone.opacity <= 0.16)).toBe(true);
    expect(FLOATING_BONES.some((bone) => bone.tone === "coral")).toBe(true);
  });

  it("mounts the shared motif on landing and questionnaire screens", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page.match(/<FloatingBones \/>/g)).toHaveLength(2);
  });
});
