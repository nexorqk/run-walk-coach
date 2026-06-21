import type { Prisma } from "@prisma/client";
import type { ProgressionAction } from "@run-walk-coach/shared";
import { prisma } from "./prisma.js";

type SessionWithTemplate = Prisma.WorkoutSessionGetPayload<{
  include: { template: true };
}>;

function isSuccessfulSession(session: SessionWithTemplate) {
  return (
    session.pain === "NONE" &&
    session.difficulty <= 6 &&
    ["EASY", "MEDIUM", "HARD"].includes(session.breathing) &&
    (session.maxHr === null || session.maxHr < 160)
  );
}

async function getDefaultTemplate(level: number) {
  const normalizedLevel = Math.min(10, Math.max(1, level));
  const template = await prisma.workoutTemplate.findFirst({
    where: {
      userId: null,
      isDefault: true,
      level: normalizedLevel
    }
  });

  if (!template) {
    throw new Error(`Default workout template for level ${normalizedLevel} is missing.`);
  }

  return template;
}

function sessionLevel(session: SessionWithTemplate) {
  return session.template?.level ?? 1;
}

function makeResult(action: ProgressionAction, template: Awaited<ReturnType<typeof getDefaultTemplate>>, reason: string) {
  return { action, template, reason };
}

export async function getNextWorkoutSuggestion(userId: string) {
  const recentSessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: { template: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20
  });

  if (recentSessions.length === 0) {
    return makeResult(
      "repeat",
      await getDefaultTemplate(1),
      "Start with Level 1 and keep the effort easy."
    );
  }

  const latest = recentSessions[0];
  const currentLevel = sessionLevel(latest);

  if (latest.pain !== "NONE") {
    const action: ProgressionAction = currentLevel > 1 ? "regress" : "repeat";
    const nextLevel = currentLevel > 1 ? currentLevel - 1 : currentLevel;

    return makeResult(
      action,
      await getDefaultTemplate(nextLevel),
      "Pain was reported in the latest session, so reduce or repeat the load."
    );
  }

  if (latest.difficulty >= 8) {
    return makeResult(
      "repeat",
      await getDefaultTemplate(currentLevel),
      "The latest session was too hard, so repeat this level."
    );
  }

  if (latest.breathing === "VERY_HARD") {
    return makeResult(
      "repeat",
      await getDefaultTemplate(currentLevel),
      "Breathing load was too high, so repeat this level."
    );
  }

  if (latest.maxHr !== null && latest.maxHr >= 170) {
    return makeResult(
      "repeat",
      await getDefaultTemplate(currentLevel),
      "Heart rate was too high, so repeat this level."
    );
  }

  const firstTwo = recentSessions.slice(0, 2);
  const hasTwoSuccessfulAtCurrentLevel =
    firstTwo.length === 2 &&
    firstTwo.every((session) => sessionLevel(session) === currentLevel && isSuccessfulSession(session));

  if (hasTwoSuccessfulAtCurrentLevel) {
    if (currentLevel >= 10) {
      return makeResult(
        "repeat",
        await getDefaultTemplate(10),
        "You are already at Level 10; keep the easy run controlled."
      );
    }

    return makeResult(
      "progress",
      await getDefaultTemplate(currentLevel + 1),
      "Two successful sessions in a row at the current level are complete."
    );
  }

  return makeResult(
    "repeat",
    await getDefaultTemplate(currentLevel),
    "Repeat this level until two controlled sessions are completed in a row."
  );
}
