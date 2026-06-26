import { describe, expect, it } from "vitest";
import { buildCoachInsights, type CoachInsightSession } from "../src/utils/coach-insights.js";

function session(
  date: string,
  avgPaceSecPerKm: number,
  maxHr: number,
  overrides: Partial<CoachInsightSession> = {}
): CoachInsightSession {
  return {
    date,
    completed: true,
    totalDurationSec: 1800,
    totalRunSec: 900,
    avgPaceSecPerKm,
    maxHr,
    difficulty: 5,
    breathing: "MEDIUM",
    pain: "NONE",
    ...overrides
  };
}

describe("buildCoachInsights", () => {
  it("flags pain and high heart rate", () => {
    const insights = buildCoachInsights({
      easyHrMax: 145,
      sessions: [
        session("2026-06-25T08:00:00.000Z", 540, 168, {
          pain: "SHIN"
        })
      ]
    });

    expect(insights.map((insight) => insight.code)).toContain("pain");
    expect(insights.map((insight) => insight.code)).toContain("hr-high");
  });

  it("detects improving pace without higher pulse", () => {
    const insights = buildCoachInsights({
      easyHrMax: 150,
      sessions: [
        session("2026-06-25T08:00:00.000Z", 520, 140),
        session("2026-06-23T08:00:00.000Z", 525, 141),
        session("2026-06-21T08:00:00.000Z", 530, 140),
        session("2026-06-18T08:00:00.000Z", 550, 140),
        session("2026-06-16T08:00:00.000Z", 555, 139),
        session("2026-06-14T08:00:00.000Z", 560, 141)
      ]
    });

    expect(insights.map((insight) => insight.code)).toContain("efficiency-up");
  });
});
