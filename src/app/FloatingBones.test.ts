import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FLOATING_BONES } from "./FloatingBones";

describe("FloatingBones", () => {
  it("defines a deterministic, restrained landing-page motif", () => {
    expect(FLOATING_BONES).toHaveLength(9);
    expect(new Set(FLOATING_BONES.map((bone) => bone.id)).size).toBe(9);
    expect(FLOATING_BONES.every((bone) => bone.opacity <= 0.16)).toBe(true);
    expect(FLOATING_BONES.every((bone) => bone.tone === "teal")).toBe(true);
  });

  it("mounts the shared motif on both chat variants (AI-led + classic STEPS fallback) and both results states (landing's editorial redesign has no decorative motif)", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page.match(/<FloatingBones \/>/g)).toHaveLength(4);
  });
});
