import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkoutSessionSchema,
  UpdateUserProfileSchema,
  UpdateWorkoutSessionSchema,
  UpdateWorkoutTemplateSchema
} from "@run-walk-coach/shared";
import { z } from "zod";
import {
  beginGoogleLogin,
  completeGoogleLogin,
  deleteCurrentUser,
  googleAuthStatus,
  logoutCurrentSession,
  requireCurrentUser
} from "./auth.js";
import { env } from "./env.js";
import { getNextWorkoutSuggestion } from "./progression.js";
import { prisma } from "./prisma.js";

function validationError(reply: FastifyReply, issues: unknown) {
  return reply.status(400).send({
    error: "ValidationError",
    issues
  });
}

const ClientErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  source: z.string().max(200).optional(),
  path: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  language: z.string().max(20).optional()
});

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function formatTemplateSeconds(seconds: number) {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} min`;
  }

  return `${seconds} sec`;
}

function templateName(level: number, type: string, runSec: number, walkSec: number) {
  if (type === "WALK") {
    return `Level ${level} - ${formatTemplateSeconds(walkSec || runSec)} walk`;
  }

  if (type === "EASY_RUN") {
    return `Level ${level} - ${formatTemplateSeconds(runSec)} easy run`;
  }

  if (walkSec === 0) {
    return `Level ${level} - ${formatTemplateSeconds(runSec)} run`;
  }

  return `Level ${level} - ${formatTemplateSeconds(runSec)} run / ${formatTemplateSeconds(walkSec)} walk`;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health/live", async () => ({
    ok: true,
    service: "run-walk-coach-api"
  }));

  app.get("/api/health/ready", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      service: "run-walk-coach-api",
      database: "ready"
    };
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "run-walk-coach-api"
  }));

  if (env.nodeEnv !== "production") {
    app.get("/api/metrics", async () => ({
      uptimeSec: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeEnv: env.nodeEnv
    }));
  }

  app.post(
    "/api/client-errors",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 5 * 60_000
        }
      }
    },
    async (request, reply) => {
      const parsed = ClientErrorSchema.safeParse(request.body);

      if (!parsed.success) {
        return validationError(reply, parsed.error.issues);
      }

      request.log.warn(
        {
          clientError: parsed.data,
          requestId: request.id
        },
        "Client runtime error"
      );

      return reply.status(204).send();
    }
  );

  app.get("/api/profile", async (request, reply) => requireCurrentUser(request, reply));

  app.delete("/api/profile", async (request, reply) => {
    const deleted = await deleteCurrentUser(request, reply);

    if (!deleted) {
      return;
    }

    return reply.status(204).send();
  });

  app.get("/api/auth/providers", async () => ({
    google: googleAuthStatus()
  }));

  app.get(
    "/api/auth/google/start",
    {
      config: {
        rateLimit: {
          max: env.authRateLimitMax,
          timeWindow: env.authRateLimitWindowMs
        }
      }
    },
    async (_request, reply) => beginGoogleLogin(reply)
  );

  app.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
    };
  }>(
    "/api/auth/google/callback",
    {
      config: {
        rateLimit: {
          max: env.authRateLimitMax,
          timeWindow: env.authRateLimitWindowMs
        }
      }
    },
    async (request, reply) => completeGoogleLogin(request.query, request, reply)
  );

  app.post("/api/auth/logout", async (request, reply) => {
    await logoutCurrentSession(request, reply);
    return reply.status(204).send();
  });

  app.patch("/api/profile", async (request, reply) => {
    const parsed = UpdateUserProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const nextEasyHrMin = parsed.data.easyHrMin ?? user.easyHrMin;
    const nextEasyHrMax = parsed.data.easyHrMax ?? user.easyHrMax;

    if (nextEasyHrMin >= nextEasyHrMax) {
      return validationError(reply, [
        {
          path: ["easyHrMin"],
          message: "easyHrMin must be lower than easyHrMax"
        }
      ]);
    }

    return prisma.user.update({
      where: { id: user.id },
      data: parsed.data
    });
  });

  app.get("/api/workout-templates", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;

    return prisma.workoutTemplate.findMany({
      where: {
        OR: [{ userId: null }, { userId: user.id }]
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });
  });

  app.get("/api/workout-templates/current", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const suggestion = await getNextWorkoutSuggestion(user.id);
    return suggestion.template;
  });

  app.patch<{ Params: { id: string } }>("/api/workout-templates/:id", async (request, reply) => {
    const parsed = UpdateWorkoutTemplateSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const template = await prisma.workoutTemplate.findFirst({
      where: {
        id: request.params.id,
        OR: [{ userId: null }, { userId: user.id }]
      }
    });

    if (!template) {
      return reply.status(404).send({ error: "WorkoutTemplateNotFound" });
    }

    const timing = {
      warmupSec: parsed.data.warmupSec ?? template.warmupSec,
      runSec: parsed.data.runSec ?? template.runSec,
      walkSec: parsed.data.walkSec ?? template.walkSec,
      cooldownSec: parsed.data.cooldownSec ?? template.cooldownSec
    };
    const data = {
      ...timing,
      name: templateName(template.level, template.type, timing.runSec, timing.walkSec)
    };

    if (template.userId === user.id) {
      return prisma.workoutTemplate.update({
        where: { id: template.id },
        data
      });
    }

    const existingOverride = await prisma.workoutTemplate.findFirst({
      where: {
        userId: user.id,
        level: template.level
      },
      orderBy: { createdAt: "desc" }
    });

    if (existingOverride) {
      return prisma.workoutTemplate.update({
        where: { id: existingOverride.id },
        data
      });
    }

    return prisma.workoutTemplate.create({
      data: {
        userId: user.id,
        level: template.level,
        type: template.type,
        repeats: template.repeats,
        isDefault: false,
        ...data
      }
    });
  });

  app.get("/api/progression/next", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    return getNextWorkoutSuggestion(user.id);
  });

  app.get("/api/sessions", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    return prisma.workoutSession.findMany({
      where: { userId: user.id },
      include: { template: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });
  });

  app.post("/api/sessions", async (request, reply) => {
    const parsed = CreateWorkoutSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const templateId = parsed.data.templateId ?? null;
    const clientSessionId = parsed.data.clientSessionId ?? null;

    if (templateId) {
      const template = await prisma.workoutTemplate.findFirst({
        where: {
          id: templateId,
          OR: [{ userId: null }, { userId: user.id }]
        }
      });

      if (!template) {
        return reply.status(404).send({ error: "WorkoutTemplateNotFound" });
      }
    }

    if (clientSessionId) {
      const existing = await prisma.workoutSession.findUnique({
        where: {
          userId_clientSessionId: {
            userId: user.id,
            clientSessionId
          }
        },
        include: { template: true }
      });

      if (existing) {
        return existing;
      }
    }

    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        clientSessionId,
        templateId,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        completed: parsed.data.completed,
        totalDurationSec: parsed.data.totalDurationSec,
        totalRunSec: parsed.data.totalRunSec,
        totalWalkSec: parsed.data.totalWalkSec,
        avgHr: parsed.data.avgHr ?? null,
        maxHr: parsed.data.maxHr ?? null,
        stopwatchPulseBpm: parsed.data.stopwatchPulseBpm ?? null,
        heartRateZone: parsed.data.heartRateZone ?? null,
        distanceMeters: parsed.data.distanceMeters ?? null,
        avgPaceSecPerKm: parsed.data.avgPaceSecPerKm ?? null,
        avgSpeedKmh: parsed.data.avgSpeedKmh ?? null,
        cadenceSpm: parsed.data.cadenceSpm ?? null,
        difficulty: parsed.data.difficulty,
        breathing: parsed.data.breathing,
        breathingNote: parsed.data.breathingNote ?? null,
        pain: parsed.data.pain,
        notes: parsed.data.notes ?? null
      },
      include: { template: true }
    });

    return reply.status(201).send(session);
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const session = await prisma.workoutSession.findFirst({
      where: {
        id: request.params.id,
        userId: user.id
      },
      include: { template: true }
    });

    if (!session) {
      return reply.status(404).send({ error: "WorkoutSessionNotFound" });
    }

    return session;
  });

  app.patch<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const parsed = UpdateWorkoutSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const session = await prisma.workoutSession.findFirst({
      where: {
        id: request.params.id,
        userId: user.id
      }
    });

    if (!session) {
      return reply.status(404).send({ error: "WorkoutSessionNotFound" });
    }

    const { date, ...data } = parsed.data;

    return prisma.workoutSession.update({
      where: { id: request.params.id },
      data: {
        ...data,
        date: date ? new Date(date) : undefined
      },
      include: { template: true }
    });
  });

  app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const session = await prisma.workoutSession.findFirst({
      where: {
        id: request.params.id,
        userId: user.id
      }
    });

    if (!session) {
      return reply.status(404).send({ error: "WorkoutSessionNotFound" });
    }

    await prisma.workoutSession.delete({
      where: { id: request.params.id }
    });

    return reply.status(204).send();
  });

  app.get("/api/analytics/summary", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const weekStart = startOfWeek(new Date());
    const sessionsThisWeek = await prisma.workoutSession.findMany({
      where: {
        userId: user.id,
        date: {
          gte: weekStart
        }
      },
      include: { template: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    const allSessions = await prisma.workoutSession.findMany({
      where: { userId: user.id },
      include: { template: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 1
    });

    const averageDifficulty =
      sessionsThisWeek.length === 0
        ? null
        : sessionsThisWeek.reduce((sum, session) => sum + session.difficulty, 0) /
          sessionsThisWeek.length;

    const next = await getNextWorkoutSuggestion(user.id);

    return {
      sessionsThisWeek: sessionsThisWeek.length,
      totalDurationThisWeekSec: sessionsThisWeek.reduce(
        (sum, session) => sum + session.totalDurationSec,
        0
      ),
      totalRunThisWeekSec: sessionsThisWeek.reduce((sum, session) => sum + session.totalRunSec, 0),
      averageDifficulty,
      currentLevel: allSessions[0]?.template?.level ?? 1,
      next
    };
  });

  app.get("/api/export/json", async (request, reply) => {
    const user = await requireCurrentUser(request, reply);
    if (!user) return;
    const [templates, sessions, exercises, strengthTemplates, strengthSessions, userRules, userExerciseStates] = await Promise.all([
      prisma.workoutTemplate.findMany({
        where: {
          OR: [{ userId: null }, { userId: user.id }]
        },
        orderBy: [{ level: "asc" }]
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id },
        include: { template: true },
        orderBy: [{ date: "desc" }]
      }),
      prisma.exercise.findMany({
        include: {
          alternatives: {
            include: { alternativeExercise: true }
          }
        },
        orderBy: [{ category: "asc" }, { name: "asc" }]
      }),
      prisma.strengthWorkoutTemplate.findMany({
        include: {
          exercises: {
            include: { exercise: true },
            orderBy: { sortOrder: "asc" }
          }
        },
        orderBy: [{ name: "asc" }]
      }),
      prisma.strengthWorkoutSession.findMany({
        where: { userId: user.id },
        include: {
          template: true,
          setLogs: {
            include: { exercise: true },
            orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }]
          },
          feedback: {
            include: { exercise: true },
            orderBy: [{ exerciseId: "asc" }]
          }
        },
        orderBy: [{ date: "desc" }]
      }),
      prisma.userRule.findMany({
        where: { userId: user.id },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
      }),
      prisma.userExerciseState.findMany({
        where: { userId: user.id },
        include: { exercise: true },
        orderBy: [{ updatedAt: "desc" }]
      })
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      templates,
      sessions,
      exercises,
      strengthTemplates,
      strengthSessions,
      userRules,
      userExerciseStates
    };
  });
}
