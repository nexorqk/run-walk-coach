import { describe, expect, it } from "vitest";
import { CreateWorkoutSessionSchema } from "../src/schemas.js";

describe("CreateWorkoutSessionSchema", () => {
  it("accepts a client session id for idempotent sync", () => {
    const parsed = CreateWorkoutSessionSchema.parse({
      clientSessionId: "4ef8604a-5675-47d0-8270-bd8938c960c5",
      templateId: null,
      completed: true,
      totalDurationSec: 120,
      totalRunSec: 60,
      totalWalkSec: 60,
      difficulty: 5,
      breathing: "MEDIUM",
      pain: "NONE"
    });

    expect(parsed.clientSessionId).toBe("4ef8604a-5675-47d0-8270-bd8938c960c5");
  });
});
