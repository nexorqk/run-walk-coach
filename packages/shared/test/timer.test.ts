import { describe, expect, it } from "vitest";
import { buildWorkoutTimeline, getWorkoutTotalsAtElapsedMs } from "../src/timer.js";

describe("buildWorkoutTimeline", () => {
  it("builds warmup, run/walk repeats, and cooldown totals", () => {
    const timeline = buildWorkoutTimeline({
      warmupSec: 60,
      runSec: 30,
      walkSec: 45,
      repeats: 2,
      cooldownSec: 90
    });

    expect(timeline.steps).toEqual([
      { phase: "WARMUP", durationSec: 60 },
      { phase: "RUN", durationSec: 30, repeatIndex: 1 },
      { phase: "WALK", durationSec: 45, repeatIndex: 1 },
      { phase: "RUN", durationSec: 30, repeatIndex: 2 },
      { phase: "WALK", durationSec: 45, repeatIndex: 2 },
      { phase: "COOLDOWN", durationSec: 90 }
    ]);
    expect(timeline.totalDurationSec).toBe(300);
    expect(timeline.totalRunSec).toBe(60);
    expect(timeline.totalWalkSec).toBe(90);
  });
});

describe("getWorkoutTotalsAtElapsedMs", () => {
  it("counts partial run and walk totals at elapsed time", () => {
    const timeline = buildWorkoutTimeline({
      warmupSec: 10,
      runSec: 20,
      walkSec: 30,
      repeats: 1,
      cooldownSec: 10
    });

    expect(getWorkoutTotalsAtElapsedMs(timeline, 45_000)).toEqual({
      totalDurationSec: 45,
      totalRunSec: 20,
      totalWalkSec: 15
    });
  });
});
