import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, type WeeklyPlanSession } from "../src/utils/weekly-plan.js";

function session(date: string, totalDurationSec: number): WeeklyPlanSession {
  return {
    date,
    completed: true,
    totalDurationSec,
    totalRunSec: Math.floor(totalDurationSec / 2),
    difficulty: 5,
    pain: "NONE"
  };
}

describe("buildWeeklyPlan", () => {
  it("creates a two-run week with strength, cross-training, and rest", () => {
    const plan = buildWeeklyPlan({
      now: new Date("2026-06-25T12:00:00"),
      runTarget: 2,
      sessions: []
    });

    expect(plan.weekStartKey).toBe("2026-06-22");
    expect(plan.weekEndKey).toBe("2026-06-28");
    expect(plan.days.map((day) => day.type)).toEqual([
      "strength",
      "run",
      "cross",
      "strength",
      "run",
      "cross",
      "rest"
    ]);
  });

  it("creates a three-run week without back-to-back planned run days", () => {
    const plan = buildWeeklyPlan({
      now: new Date("2026-06-25T12:00:00"),
      runTarget: 3,
      sessions: []
    });

    expect(plan.days.map((day) => day.type)).toEqual([
      "strength",
      "run",
      "cross",
      "run",
      "strength",
      "run",
      "rest"
    ]);
  });

  it("warns when load jumps quickly or runs happen on consecutive days", () => {
    const plan = buildWeeklyPlan({
      now: new Date("2026-06-25T12:00:00"),
      runTarget: 2,
      sessions: [
        session("2026-06-16T08:00:00", 1200),
        session("2026-06-23T08:00:00", 1200),
        session("2026-06-24T08:00:00", 1200)
      ]
    });

    expect(plan.stats.completedRunsThisWeek).toBe(2);
    expect(plan.stats.loadRatio).toBe(2);
    expect(plan.warnings.map((warning) => warning.type)).toContain("load-spike");
    expect(plan.warnings.map((warning) => warning.type)).toContain("consecutive-runs");
  });
});
