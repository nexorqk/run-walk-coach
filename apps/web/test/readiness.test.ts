import { describe, expect, it } from "vitest";
import { defaultReadinessCheck, evaluateReadiness } from "../src/utils/readiness.js";

describe("evaluateReadiness", () => {
  it("sends red-flag symptoms to medical help", () => {
    const result = evaluateReadiness({
      ...defaultReadinessCheck,
      redFlags: true
    });

    expect(result.action).toBe("medical");
    expect(result.reasons).toContain("red-flags");
  });

  it("recommends rest for fever or below-neck illness", () => {
    expect(evaluateReadiness({ ...defaultReadinessCheck, illness: "fever" }).action).toBe("rest");
    expect(evaluateReadiness({ ...defaultReadinessCheck, illness: "below_neck" }).action).toBe("rest");
  });

  it("allows running when recovery signals look good", () => {
    const result = evaluateReadiness(defaultReadinessCheck);

    expect(result.action).toBe("run");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });
});
