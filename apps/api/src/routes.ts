import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkoutSessionSchema,
  UpdateUserProfileSchema
} from "@run-walk-coach/shared";
import { ensureDevUser } from "./bootstrap.js";
import { getNextWorkoutSuggestion } from "./progression.js";
import { prisma } from "./prisma.js";

function validationError(reply: FastifyReply, issues: unknown) {
  return reply.status(400).send({
    error: "ValidationError",
    issues
  });
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({
    ok: true,
    service: "run-walk-coach-api"
  }));

  app.get("/api/profile", async () => ensureDevUser());

  app.patch("/api/profile", async (request, reply) => {
    const parsed = UpdateUserProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return validationError(reply, parsed.error.issues);
    }

    const user = await ensureDevUser();
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

  app.get("/api/workout-templates", async () =>
    prisma.workoutTemplate.findMany({
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    })
  );

  app.get("/api/workout-templates/current", async () => {
    const user = await ensureDevUser();
    const suggestion = await getNextWorkoutSuggestion(user.id);
    return suggestion.template;
  });

  app.get("/api/progression/next", async () => {
    const user = await ensureDevUser();
    return getNextWorkoutSuggestion(user.id);
  });

  app.get("/api/sessions", async () => {
    const user = await ensureDevUser();
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

    const user = await ensureDevUser();
    const templateId = parsed.data.templateId ?? null;

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

    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        templateId,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        completed: parsed.data.completed,
        totalDurationSec: parsed.data.totalDurationSec,
        totalRunSec: parsed.data.totalRunSec,
        totalWalkSec: parsed.data.totalWalkSec,
        avgHr: parsed.data.avgHr ?? null,
        maxHr: parsed.data.maxHr ?? null,
        difficulty: parsed.data.difficulty,
        breathing: parsed.data.breathing,
        pain: parsed.data.pain,
        notes: parsed.data.notes ?? null
      },
      include: { template: true }
    });

    return reply.status(201).send(session);
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const user = await ensureDevUser();
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

  app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const user = await ensureDevUser();
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

  app.get("/api/analytics/summary", async () => {
    const user = await ensureDevUser();
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

  app.get("/api/export/json", async () => {
    const user = await ensureDevUser();
    const [templates, sessions] = await Promise.all([
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
      })
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      templates,
      sessions
    };
  });
}
