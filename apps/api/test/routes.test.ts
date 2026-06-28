import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  googleId: "google-123",
  heightCm: 175,
  goalSpeedKmh: 8,
  easyHrMin: 120,
  easyHrMax: 150,
  googleLinkedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockTemplate = {
  id: "tmpl-1",
  userId: null,
  name: "Level 1 - 1 min run / 2 min walk",
  level: 1,
  type: "RUN_WALK",
  warmupSec: 300,
  runSec: 60,
  walkSec: 120,
  repeats: 8,
  cooldownSec: 300,
  isDefault: true,
  createdAt: new Date().toISOString()
};

const mockSession = {
  id: "sess-1",
  userId: "user-1",
  clientSessionId: null,
  templateId: "tmpl-1",
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
  template: mockTemplate
};

const prismaMock = {
  $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  user: {
    update: vi.fn().mockResolvedValue(mockUser),
    delete: vi.fn().mockResolvedValue(mockUser)
  },
  workoutTemplate: {
    findMany: vi.fn().mockResolvedValue([mockTemplate]),
    findFirst: vi.fn().mockResolvedValue(mockTemplate),
    update: vi.fn().mockResolvedValue(mockTemplate),
    create: vi.fn().mockResolvedValue(mockTemplate)
  },
  workoutSession: {
    findMany: vi.fn().mockResolvedValue([mockSession]),
    findFirst: vi.fn().mockResolvedValue(mockSession),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockSession),
    update: vi.fn().mockResolvedValue(mockSession),
    delete: vi.fn().mockResolvedValue(mockSession)
  },
  exercise: { findMany: vi.fn().mockResolvedValue([]) },
  strengthWorkoutTemplate: { findMany: vi.fn().mockResolvedValue([]) },
  strengthWorkoutSession: { findMany: vi.fn().mockResolvedValue([]) },
  userRule: { findMany: vi.fn().mockResolvedValue([]) },
  userExerciseState: { findMany: vi.fn().mockResolvedValue([]) }
};

vi.mock("../src/prisma.js", () => ({ prisma: prismaMock }));

vi.mock("../src/auth.js", () => ({
  requireCurrentUser: vi.fn().mockResolvedValue(mockUser),
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
  googleAuthStatus: vi.fn().mockReturnValue({ enabled: false, redirectUri: "" }),
  beginGoogleLogin: vi.fn(),
  completeGoogleLogin: vi.fn(),
  logoutCurrentSession: vi.fn(),
  deleteCurrentUser: vi.fn().mockResolvedValue(true)
}));

vi.mock("../src/progression.js", () => ({
  getNextWorkoutSuggestion: vi.fn().mockResolvedValue({
    action: "repeat",
    template: mockTemplate,
    reason: "Repeat this level."
  })
}));

let app: FastifyInstance;

async function buildTestApp() {
  const cookie = await import("@fastify/cookie");
  const Fastify = (await import("fastify")).default;
  const testApp = Fastify({ logger: false });
  await testApp.register(cookie.default);
  const { registerRoutes } = await import("../src/routes.js");
  await registerRoutes(testApp);
  return testApp;
}

beforeEach(async () => {
  vi.clearAllMocks();
  if (app) {
    await app.close();
  }
  app = await buildTestApp();
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "run-walk-coach-api" });
  });
});

describe("GET /api/health/live", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health/live" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "run-walk-coach-api" });
  });
});

describe("GET /api/health/ready", () => {
  it("returns ok with database ready", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, database: "ready" });
  });
});

describe("GET /api/auth/providers", () => {
  it("returns provider status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/providers" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("google");
  });
});

describe("POST /api/client-errors", () => {
  it("accepts valid error payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-errors",
      payload: { message: "Something broke" }
    });
    expect(res.statusCode).toBe(204);
  });

  it("rejects empty message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-errors",
      payload: { message: "" }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("ValidationError");
  });

  it("rejects missing message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-errors",
      payload: {}
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects message over 2000 chars", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-errors",
      payload: { message: "x".repeat(2001) }
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts optional fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/client-errors",
      payload: {
        message: "Error",
        stack: "at main (app.js:1)",
        source: "app.js",
        path: "/today",
        userAgent: "Mozilla/5.0",
        language: "en"
      }
    });
    expect(res.statusCode).toBe(204);
  });
});

describe("GET /api/profile", () => {
  it("returns user profile", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("user-1");
  });
});

describe("PATCH /api/profile", () => {
  it("updates valid fields", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { heightCm: 180, goalSpeedKmh: 10 }
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects easyHrMin >= easyHrMax", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { easyHrMin: 160, easyHrMax: 150 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects heightCm out of range", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { heightCm: 50 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects goalSpeedKmh out of range", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { goalSpeedKmh: 1 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts empty body (no-op update)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: {}
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/profile", () => {
  it("deletes and returns 204", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/profile" });
    expect(res.statusCode).toBe(204);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(res.statusCode).toBe(204);
  });
});

describe("GET /api/workout-templates", () => {
  it("returns templates array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/workout-templates" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe("GET /api/workout-templates/current", () => {
  it("returns current template", async () => {
    const res = await app.inject({ method: "GET", url: "/api/workout-templates/current" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("id");
  });
});

describe("PATCH /api/workout-templates/:id", () => {
  it("updates template timing", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workout-templates/tmpl-1",
      payload: { runSec: 90, walkSec: 90 }
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects empty body", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workout-templates/tmpl-1",
      payload: {}
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects runSec of 0", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workout-templates/tmpl-1",
      payload: { runSec: 0 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects values over 3600", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workout-templates/tmpl-1",
      payload: { warmupSec: 3601 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for missing template", async () => {
    prismaMock.workoutTemplate.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workout-templates/nonexistent",
      payload: { runSec: 90 }
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("WorkoutTemplateNotFound");
  });
});

describe("GET /api/progression/next", () => {
  it("returns progression suggestion", async () => {
    const res = await app.inject({ method: "GET", url: "/api/progression/next" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("action");
    expect(res.json()).toHaveProperty("template");
    expect(res.json()).toHaveProperty("reason");
  });
});

describe("GET /api/sessions", () => {
  it("returns sessions array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe("POST /api/sessions", () => {
  const validSession = {
    templateId: "tmpl-1",
    completed: true,
    totalDurationSec: 1800,
    totalRunSec: 480,
    totalWalkSec: 960,
    difficulty: 5,
    breathing: "MEDIUM",
    pain: "NONE"
  };

  it("creates a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: validSession
    });
    expect(res.statusCode).toBe(201);
  });

  it("rejects missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { templateId: "tmpl-1" }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid breathing level", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, breathing: "INVALID" }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid pain type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, pain: "INVALID" }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects difficulty out of range", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, difficulty: 11 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects avgHr out of range", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, avgHr: 10 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts optional running metrics", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {
        ...validSession,
        avgHr: 140,
        maxHr: 170,
        distanceMeters: 3000,
        avgPaceSecPerKm: 360,
        avgSpeedKmh: 10,
        cadenceSpm: 170,
        heartRateZone: "ZONE_3"
      }
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns existing session for duplicate clientSessionId", async () => {
    prismaMock.workoutSession.findUnique.mockResolvedValueOnce(mockSession);
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, clientSessionId: "550e8400-e29b-41d4-a716-446655440000" }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("sess-1");
  });

  it("returns 404 for nonexistent template", async () => {
    prismaMock.workoutTemplate.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { ...validSession, templateId: "nonexistent" }
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/sessions/:id", () => {
  it("returns a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sessions/sess-1" });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe("sess-1");
  });

  it("returns 404 for missing session", async () => {
    prismaMock.workoutSession.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({ method: "GET", url: "/api/sessions/nonexistent" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("WorkoutSessionNotFound");
  });
});

describe("PATCH /api/sessions/:id", () => {
  it("updates session fields", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/sessions/sess-1",
      payload: { difficulty: 7, notes: "Felt good" }
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects empty body", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/sessions/sess-1",
      payload: {}
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for missing session", async () => {
    prismaMock.workoutSession.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/sessions/nonexistent",
      payload: { difficulty: 5 }
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/sessions/:id", () => {
  it("deletes and returns 204", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/sessions/sess-1" });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for missing session", async () => {
    prismaMock.workoutSession.findFirst.mockResolvedValueOnce(null);
    const res = await app.inject({ method: "DELETE", url: "/api/sessions/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/analytics/summary", () => {
  it("returns analytics summary", async () => {
    const res = await app.inject({ method: "GET", url: "/api/analytics/summary" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("sessionsThisWeek");
    expect(body).toHaveProperty("totalDurationThisWeekSec");
    expect(body).toHaveProperty("totalRunThisWeekSec");
    expect(body).toHaveProperty("averageDifficulty");
    expect(body).toHaveProperty("currentLevel");
    expect(body).toHaveProperty("next");
  });
});

describe("GET /api/export/json", () => {
  it("returns full export", async () => {
    const res = await app.inject({ method: "GET", url: "/api/export/json" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("exportedAt");
    expect(body).toHaveProperty("profile");
    expect(body).toHaveProperty("templates");
    expect(body).toHaveProperty("sessions");
    expect(body).toHaveProperty("exercises");
    expect(body).toHaveProperty("strengthTemplates");
    expect(body).toHaveProperty("strengthSessions");
    expect(body).toHaveProperty("userRules");
    expect(body).toHaveProperty("userExerciseStates");
  });
});
