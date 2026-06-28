import type { Prisma } from "@prisma/client";
import type { AdaptationDetail, BreathingLevel, PainType, ProgressionAction } from "@run-walk-coach/shared";
import { prisma } from "./prisma.js";

type SessionWithTemplate = Prisma.WorkoutSessionGetPayload<{
  include: { template: true };
}>;

type AdaptedTemplate = {
  id: string;
  userId: string | null;
  name: string;
  level: number;
  type: string;
  warmupSec: number;
  runSec: number;
  walkSec: number;
  repeats: number;
  cooldownSec: number;
  isDefault: boolean;
  createdAt: Date;
};

type ProgressionResult = {
  action: ProgressionAction;
  template: AdaptedTemplate;
  reason: string;
  adaptations: AdaptationDetail[];
  sessionData: {
    difficulty: number;
    pain: PainType;
    breathing: BreathingLevel;
    maxHr: number | null;
    completed: boolean;
  };
};

const RUN_STEP_SEC = 15;
const WALK_STEP_SEC = 10;
const MIN_RUN_SEC = 15;
const MAX_RUN_SEC = 1800;
const MIN_WALK_SEC = 0;
const MAX_WALK_SEC = 300;
const MIN_REPEATS = 1;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isSuccessfulSession(session: SessionWithTemplate) {
  return (
    session.pain === "NONE" &&
    session.difficulty <= 6 &&
    ["EASY", "MEDIUM", "HARD"].includes(session.breathing) &&
    (session.maxHr === null || session.maxHr < 160) &&
    session.completed
  );
}

function sessionLevel(session: SessionWithTemplate) {
  return session.template?.level ?? 1;
}

async function getPreferredTemplate(userId: string, level: number) {
  const normalizedLevel = Math.min(10, Math.max(1, level));
  const userTemplate = await prisma.workoutTemplate.findFirst({
    where: { userId, level: normalizedLevel },
    orderBy: { createdAt: "desc" }
  });

  if (userTemplate) {
    return userTemplate;
  }

  const template = await prisma.workoutTemplate.findFirst({
    where: { userId: null, isDefault: true, level: normalizedLevel }
  });

  if (!template) {
    throw new Error(`Default workout template for level ${normalizedLevel} is missing.`);
  }

  return template;
}

function applyAdaptations(
  template: SessionWithTemplate["template"],
  adaptations: AdaptationDetail[]
): AdaptedTemplate {
  if (!template) {
    throw new Error("Cannot apply adaptations to null template");
  }

  let runSec = template.runSec;
  let walkSec = template.walkSec;
  let repeats = template.repeats;

  for (const adaptation of adaptations) {
    if (adaptation.field === "runSec") {
      runSec = clamp(runSec + adaptation.delta, MIN_RUN_SEC, MAX_RUN_SEC);
    } else if (adaptation.field === "walkSec") {
      walkSec = clamp(walkSec + adaptation.delta, MIN_WALK_SEC, MAX_WALK_SEC);
    } else if (adaptation.field === "repeats") {
      repeats = clamp(repeats + adaptation.delta, MIN_REPEATS, 50);
    }
  }

  return {
    ...template,
    runSec,
    walkSec,
    repeats
  };
}

function buildResult(
  action: ProgressionAction,
  template: AdaptedTemplate,
  reason: string,
  adaptations: AdaptationDetail[],
  session: SessionWithTemplate
): ProgressionResult {
  return {
    action,
    template,
    reason,
    adaptations,
    sessionData: {
      difficulty: session.difficulty,
      pain: session.pain as PainType,
      breathing: session.breathing as BreathingLevel,
      maxHr: session.maxHr,
      completed: session.completed
    }
  };
}

function formatTime(sec: number) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
  }
  return `${sec} sec`;
}

function buildPersonalizedReason(
  session: SessionWithTemplate,
  adaptations: AdaptationDetail[],
  action: ProgressionAction
): string {
  const parts: string[] = [];

  if (!session.completed) {
    parts.push("The workout was not completed");
  } else {
    parts.push("The workout was completed");
  }

  parts.push(`difficulty was ${session.difficulty}/10`);

  if (session.pain !== "NONE") {
    parts.push(`pain reported (${session.pain.toLowerCase()})`);
  } else {
    parts.push("no pain");
  }

  if (session.breathing === "VERY_HARD") {
    parts.push("breathing was very hard");
  } else if (session.breathing === "HARD") {
    parts.push("breathing was hard");
  }

  if (session.maxHr !== null && session.maxHr >= 160) {
    parts.push(`max HR was ${session.maxHr}`);
  }

  if (adaptations.length > 0) {
    const changes = adaptations
      .map((a) => {
        const sign = a.delta > 0 ? "+" : "";
        return `${a.field === "runSec" ? "run" : a.field === "walkSec" ? "walk" : "repeats"} ${sign}${a.delta}${a.field !== "repeats" ? "s" : ""}`;
      })
      .join(", ");
    parts.push(`so ${changes}`);
  } else if (action === "repeat") {
    parts.push("so repeating the same workout");
  } else if (action === "progress") {
    parts.push("so moving to the next level");
  } else if (action === "regress") {
    parts.push("so reducing the load");
  }

  return parts.join(", ") + ".";
}

export async function getNextWorkoutSuggestion(userId: string): Promise<ProgressionResult> {
  const recentSessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: { template: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20
  });

  if (recentSessions.length === 0) {
    const template = await getPreferredTemplate(userId, 1);
    return {
      action: "repeat",
      template,
      reason: "Start with Level 1 and keep the effort easy.",
      adaptations: [],
      sessionData: { difficulty: 0, pain: "NONE", breathing: "EASY", maxHr: null, completed: true }
    };
  }

  const latest = recentSessions[0];
  const currentLevel = sessionLevel(latest);
  const template = latest.template;
  const adaptations: AdaptationDetail[] = [];

  if (!template) {
    const fallback = await getPreferredTemplate(userId, currentLevel);
    return buildResult("repeat", fallback, "No template data found; repeating current level.", [], latest);
  }

  // Rule 1: Pain → regress
  if (latest.pain !== "NONE") {
    const action: ProgressionAction = currentLevel > 1 ? "regress" : "repeat";
    const nextLevel = currentLevel > 1 ? currentLevel - 1 : currentLevel;
    const nextTemplate = await getPreferredTemplate(userId, nextLevel);
    return buildResult(
      action,
      nextTemplate,
      buildPersonalizedReason(latest, [], action),
      [],
      latest
    );
  }

  // Rule 2: Not completed → reduce volume
  if (!latest.completed) {
    adaptations.push({
      field: "repeats",
      delta: -1,
      reasonCode: "incomplete_workout"
    });

    if (latest.difficulty >= 7) {
      adaptations.push({
        field: "runSec",
        delta: -RUN_STEP_SEC,
        reasonCode: "incomplete_and_hard"
      });
    }

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 3: Difficulty ≥ 8 → hold or reduce run
  if (latest.difficulty >= 8) {
    adaptations.push({
      field: "runSec",
      delta: -RUN_STEP_SEC,
      reasonCode: "high_difficulty"
    });

    if (latest.breathing === "VERY_HARD") {
      adaptations.push({
        field: "walkSec",
        delta: WALK_STEP_SEC,
        reasonCode: "very_hard_breathing"
      });
    }

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 4: Very hard breathing → increase walk
  if (latest.breathing === "VERY_HARD") {
    adaptations.push({
      field: "walkSec",
      delta: WALK_STEP_SEC,
      reasonCode: "very_hard_breathing"
    });

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 5: Max HR ≥ 170 → increase walk for recovery
  if (latest.maxHr !== null && latest.maxHr >= 170) {
    adaptations.push({
      field: "walkSec",
      delta: WALK_STEP_SEC,
      reasonCode: "high_heart_rate"
    });

    if (latest.maxHr >= 180) {
      adaptations.push({
        field: "runSec",
        delta: -RUN_STEP_SEC,
        reasonCode: "very_high_heart_rate"
      });
    }

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 6: Max HR 160-169 → slight walk increase
  if (latest.maxHr !== null && latest.maxHr >= 160) {
    adaptations.push({
      field: "walkSec",
      delta: WALK_STEP_SEC,
      reasonCode: "elevated_heart_rate"
    });

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 7: Two successful sessions → progress
  const firstTwo = recentSessions.slice(0, 2);
  const hasTwoSuccessfulAtCurrentLevel =
    firstTwo.length === 2 &&
    firstTwo.every((s) => sessionLevel(s) === currentLevel && isSuccessfulSession(s));

  if (hasTwoSuccessfulAtCurrentLevel) {
    if (currentLevel >= 10) {
      return buildResult(
        "repeat",
        await getPreferredTemplate(userId, 10),
        "You are already at Level 10; keep the easy run controlled.",
        [],
        latest
      );
    }

    return buildResult(
      "progress",
      await getPreferredTemplate(userId, currentLevel + 1),
      buildPersonalizedReason(latest, [], "progress"),
      [],
      latest
    );
  }

  // Rule 8: Easy session (difficulty ≤ 4, EASY breathing) → micro-increase run
  if (latest.difficulty <= 4 && latest.breathing === "EASY") {
    adaptations.push({
      field: "runSec",
      delta: RUN_STEP_SEC,
      reasonCode: "easy_session"
    });

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Rule 9: Moderate session (difficulty 5-6) → hold, slight run increase
  if (latest.difficulty <= 6 && ["EASY", "MEDIUM"].includes(latest.breathing)) {
    adaptations.push({
      field: "runSec",
      delta: RUN_STEP_SEC,
      reasonCode: "controlled_session"
    });

    const adapted = applyAdaptations(template, adaptations);
    return buildResult(
      "adjust",
      adapted,
      buildPersonalizedReason(latest, adaptations, "adjust"),
      adaptations,
      latest
    );
  }

  // Default: repeat
  return buildResult(
    "repeat",
    template,
    buildPersonalizedReason(latest, [], "repeat"),
    [],
    latest
  );
}
