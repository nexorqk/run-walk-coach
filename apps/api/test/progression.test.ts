import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

function makeSession(overrides: Record<string, unknown> = {}) {
  const templateOverrides = (overrides.template as Record<string, unknown>) ?? {};
  const level = (templateOverrides.level as number) ?? 3;
  return {
    id: "sess-1",
    userId: "user-1",
    clientSessionId: null,
    templateId: `tmpl-${level}`,
    date: new Date().toISOString(),
    completed: true,
    totalDurationSec: 1800,
    totalRunSec: 480,
    totalWalkSec: 960,
    avgHr: null,
    maxHr: null,
    stopwatchPulseBpm: null,
    heartRateZone: null,
    distanceMeters: null,
    avgPaceSecPerKm: null,
    avgSpeedKmh: null,
    cadenceSpm: null,
    difficulty: 5,
    breathing: "MEDIUM",
    breathingNote: null,
    pain: "NONE",
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: makeTemplate(level, templateOverrides),
    ...overrides
  };
}

function makeTemplate(level: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `tmpl-${level}`,
    userId: null,
    name: `Level ${level}`,
    level,
    type: "RUN_WALK",
    warmupSec: 600,
    runSec: 30 + level * 15,
    walkSec: 120,
    repeats: 12 - level,
    cooldownSec: 300,
    isDefault: true,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("../src/prisma.js", () => ({
  prisma: {
    workoutSession: { findMany: mockFindMany },
    workoutTemplate: { findFirst: mockFindFirst }
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockImplementation((_args: Record<string, unknown>) => {
    const where = _args.where as { level?: number } | undefined;
    const level = where?.level ?? 3;
    return Promise.resolve(makeTemplate(level));
  });
});

describe("getNextWorkoutSuggestion", () => {
  it("returns repeat for first-time user", async () => {
    mockFindMany.mockResolvedValue([]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("repeat");
    expect(result.template.level).toBe(1);
    expect(result.adaptations).toEqual([]);
  });

  it("regresses on pain", async () => {
    mockFindMany.mockResolvedValue([makeSession({ pain: "KNEE" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("regress");
    expect(result.template.level).toBe(2);
    expect(result.reason).toContain("pain");
  });

  it("repeats at level 1 on pain", async () => {
    mockFindMany.mockResolvedValue([
      makeSession({ pain: "SHIN", template: { ...makeSession().template, level: 1 } })
    ]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("repeat");
    expect(result.template.level).toBe(1);
  });

  it("reduces volume on incomplete workout", async () => {
    mockFindMany.mockResolvedValue([makeSession({ completed: false })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("adjust");
    expect(result.adaptations).toContainEqual(
      expect.objectContaining({ field: "repeats", delta: -1 })
    );
    expect(result.template.repeats).toBe(8);
  });

  it("reduces run and volume on incomplete hard workout", async () => {
    mockFindMany.mockResolvedValue([makeSession({ completed: false, difficulty: 8 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("adjust");
    expect(result.adaptations).toHaveLength(2);
    expect(result.template.runSec).toBe(60);
    expect(result.template.repeats).toBe(8);
  });

  it("reduces run on high difficulty", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 9 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("adjust");
    expect(result.template.runSec).toBe(60);
    expect(result.adaptations[0].reasonCode).toBe("high_difficulty");
  });

  it("increases walk on very hard breathing", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 7, breathing: "VERY_HARD" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.walkSec).toBe(130);
    expect(result.adaptations).toContainEqual(
      expect.objectContaining({ field: "walkSec", delta: 10 })
    );
  });

  it("increases walk on high heart rate", async () => {
    mockFindMany.mockResolvedValue([makeSession({ maxHr: 175 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.walkSec).toBe(130);
    expect(result.adaptations[0].reasonCode).toBe("high_heart_rate");
  });

  it("reduces run on very high heart rate (>=180)", async () => {
    mockFindMany.mockResolvedValue([makeSession({ maxHr: 185 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.walkSec).toBe(130);
    expect(result.template.runSec).toBe(60);
    expect(result.adaptations).toHaveLength(2);
  });

  it("slightly increases walk on elevated heart rate (160-169)", async () => {
    mockFindMany.mockResolvedValue([makeSession({ maxHr: 165 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.walkSec).toBe(130);
    expect(result.adaptations[0].reasonCode).toBe("elevated_heart_rate");
  });

  it("progresses after two successful sessions", async () => {
    const session1 = makeSession({ id: "s1", difficulty: 5, breathing: "MEDIUM", pain: "NONE", maxHr: null });
    const session2 = makeSession({ id: "s2", difficulty: 4, breathing: "EASY", pain: "NONE", maxHr: null });
    mockFindMany.mockResolvedValue([session1, session2]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("progress");
    expect(result.template.level).toBe(4);
  });

  it("stays at level 10 after two successful sessions", async () => {
    const tmpl = { ...makeSession().template, level: 10 };
    const session1 = makeSession({ id: "s1", template: tmpl, difficulty: 3, breathing: "EASY" });
    const session2 = makeSession({ id: "s2", template: tmpl, difficulty: 3, breathing: "EASY" });
    mockFindMany.mockResolvedValue([session1, session2]);
    mockFindFirst.mockResolvedValue(tmpl);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("repeat");
    expect(result.template.level).toBe(10);
  });

  it("micro-increases run on easy session", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 3, breathing: "EASY" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("adjust");
    expect(result.template.runSec).toBe(90);
    expect(result.adaptations[0].reasonCode).toBe("easy_session");
  });

  it("micro-increases run on controlled session", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 6, breathing: "MEDIUM" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("adjust");
    expect(result.template.runSec).toBe(90);
    expect(result.adaptations[0].reasonCode).toBe("controlled_session");
  });

  it("repeats when no clear signal", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 7, breathing: "HARD" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.action).toBe("repeat");
    expect(result.adaptations).toEqual([]);
  });

  it("includes sessionData in response", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 6, maxHr: 155 })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.sessionData).toMatchObject({
      difficulty: 6,
      pain: "NONE",
      breathing: "MEDIUM",
      maxHr: 155,
      completed: true
    });
  });

  it("personalized reason includes session data", async () => {
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 4, breathing: "EASY" })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.reason).toContain("4/10");
    expect(result.reason).toContain("no pain");
    expect(result.reason).toContain("run +15s");
  });

  it("does not reduce runSec below minimum", async () => {
    mockFindFirst.mockResolvedValue({
      ...makeSession().template,
      runSec: 15
    });
    mockFindMany.mockResolvedValue([makeSession({ difficulty: 9, template: { ...makeSession().template, runSec: 15 } })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.runSec).toBe(15);
  });

  it("does not increase walkSec above maximum", async () => {
    mockFindFirst.mockResolvedValue({
      ...makeSession().template,
      walkSec: 300
    });
    mockFindMany.mockResolvedValue([makeSession({ maxHr: 175, template: { ...makeSession().template, walkSec: 300 } })]);
    const { getNextWorkoutSuggestion } = await import("../src/progression.js");
    const result = await getNextWorkoutSuggestion("user-1");

    expect(result.template.walkSec).toBe(300);
  });
});
