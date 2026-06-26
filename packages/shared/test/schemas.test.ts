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

  it("accepts optional running metrics", () => {
    const parsed = CreateWorkoutSessionSchema.parse({
      templateId: null,
      completed: true,
      totalDurationSec: 1800,
      totalRunSec: 900,
      totalWalkSec: 900,
      avgHr: 142,
      maxHr: 158,
      stopwatchPulseBpm: 144,
      heartRateZone: "ZONE_2",
      distanceMeters: 3200,
      avgPaceSecPerKm: 563,
      avgSpeedKmh: 6.4,
      cadenceSpm: 164,
      difficulty: 5,
      breathing: "MEDIUM",
      breathingNote: "Could speak in short phrases.",
      pain: "NONE"
    });

    expect(parsed.distanceMeters).toBe(3200);
    expect(parsed.heartRateZone).toBe("ZONE_2");
    expect(parsed.avgPaceSecPerKm).toBe(563);
  });
});
