import type { PainType } from "./schemas.js";

export type StrengthProgressionAction =
  | "increase"
  | "maintain"
  | "decrease"
  | "split_volume"
  | "substitute";

export type StrengthProgressionReasonCode =
  | "completed_easy"
  | "high_difficulty"
  | "pain_detected"
  | "cardio_limited_not_muscle_limited"
  | "exercise_excluded"
  | "exercise_constraint_applied"
  | "insufficient_history";

export type StrengthProgressionExercise = {
  slug: string;
  name: string;
};

export type StrengthSetPerformance = {
  reps: number;
  completed: boolean;
  rpe?: number | null;
};

export type StrengthProgressionFeedback = {
  muscleDifficulty?: number | null;
  breathingDifficulty?: number | null;
  pain?: PainType | null;
};

export type StrengthExercisePerformance = {
  sets: StrengthSetPerformance[];
  difficulty?: number | null;
  feedback?: StrengthProgressionFeedback | null;
};

export type StrengthUserRuleInput = {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  active?: boolean;
};

export type StrengthProgressionInput = {
  exercise: StrengthProgressionExercise;
  currentSets: number;
  currentRepsMin: number;
  currentRepsMax: number;
  lastPerformances: StrengthExercisePerformance[];
  userRules?: StrengthUserRuleInput[];
};

export type StrengthProgressionDecision = {
  action: StrengthProgressionAction;
  nextSets: number;
  nextReps: string;
  reasonCode: StrengthProgressionReasonCode;
  replacementSlug?: string;
};

export const STRENGTH_PROGRESSION_EXPLANATIONS: Record<StrengthProgressionReasonCode, string> = {
  completed_easy: "All target sets were completed without pain at a controlled effort, so reps can increase slightly.",
  high_difficulty: "The latest effort was high, so the next workout should keep the same load.",
  pain_detected: "Pain was reported, so the next workout should reduce load.",
  cardio_limited_not_muscle_limited: "Breathing was the limiter, so total work is split across more sets.",
  exercise_excluded: "A user rule excludes this exercise, so a replacement should be used.",
  exercise_constraint_applied: "A user rule caps the exercise load.",
  insufficient_history: "There is not enough exercise history yet, so the current load is maintained."
};

function repsLabel(min: number, max: number) {
  return min === max ? String(min) : `${min}-${max}`;
}

function normalizeSetCount(value: number) {
  return Math.max(1, Math.round(value));
}

function sortedActiveRules(rules: StrengthUserRuleInput[] = []) {
  return rules
    .filter((rule) => rule.active !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function ruleMatchesExercise(rule: StrengthUserRuleInput, exerciseSlug: string) {
  const exercise = stringPayload(rule.payload, "exercise") ?? stringPayload(rule.payload, "exerciseSlug");
  return exercise === exerciseSlug;
}

function findRule(input: StrengthProgressionInput, type: string) {
  return sortedActiveRules(input.userRules).find(
    (rule) => rule.type === type && ruleMatchesExercise(rule, input.exercise.slug)
  );
}

function hasPain(feedback?: StrengthProgressionFeedback | null) {
  return feedback?.pain !== undefined && feedback.pain !== null && feedback.pain !== "NONE";
}

function completedAllTargetSets(performance: StrengthExercisePerformance, currentSets: number, currentRepsMax: number) {
  const completedSets = performance.sets.filter((set) => set.completed);
  return completedSets.length >= currentSets && completedSets.slice(0, currentSets).every((set) => set.reps >= currentRepsMax);
}

function capDecision(
  decision: StrengthProgressionDecision,
  input: StrengthProgressionInput
): StrengthProgressionDecision {
  const constraint = findRule(input, "exercise_constraint");

  if (!constraint || decision.action === "substitute") {
    return decision;
  }

  const maxSets = numberPayload(constraint.payload, "maxSets");
  const maxRepsPerSet = numberPayload(constraint.payload, "maxRepsPerSet");
  let nextSets = decision.nextSets;
  let nextReps = decision.nextReps;
  let changed = false;

  if (maxSets !== undefined && nextSets > maxSets) {
    nextSets = normalizeSetCount(maxSets);
    changed = true;
  }

  if (maxRepsPerSet !== undefined) {
    const cappedMax = Math.min(input.currentRepsMax, Math.max(1, Math.floor(maxRepsPerSet)));
    const cappedMin = Math.min(input.currentRepsMin, cappedMax);
    const cappedLabel = repsLabel(cappedMin, cappedMax);

    if (nextReps !== cappedLabel) {
      nextReps = cappedLabel;
      changed = true;
    }
  }

  return changed
    ? {
        ...decision,
        nextSets,
        nextReps,
        reasonCode: "exercise_constraint_applied"
      }
    : decision;
}

export function decideStrengthProgression(input: StrengthProgressionInput): StrengthProgressionDecision {
  const currentSets = normalizeSetCount(input.currentSets);
  const currentRepsMin = Math.max(1, Math.round(input.currentRepsMin));
  const currentRepsMax = Math.max(currentRepsMin, Math.round(input.currentRepsMax));
  const currentReps = repsLabel(currentRepsMin, currentRepsMax);
  const exclusion = findRule(input, "exercise_exclusion");

  if (exclusion) {
    return {
      action: "substitute",
      nextSets: currentSets,
      nextReps: currentReps,
      reasonCode: "exercise_excluded",
      replacementSlug: stringPayload(exclusion.payload, "replacement") ?? stringPayload(exclusion.payload, "replacementSlug")
    };
  }

  const latest = input.lastPerformances[0];

  if (!latest) {
    return capDecision(
      {
        action: "maintain",
        nextSets: currentSets,
        nextReps: currentReps,
        reasonCode: "insufficient_history"
      },
      input
    );
  }

  const feedback = latest.feedback;

  if (hasPain(feedback)) {
    return capDecision(
      {
        action: "decrease",
        nextSets: Math.max(1, currentSets - 1),
        nextReps: currentReps,
        reasonCode: "pain_detected"
      },
      input
    );
  }

  if (
    input.exercise.slug === "deep_squat" &&
    (feedback?.breathingDifficulty ?? 0) >= 8 &&
    (feedback?.muscleDifficulty ?? 10) <= 5
  ) {
    const nextSets = Math.max(currentSets + 1, 4);
    const splitReps = Math.max(1, Math.round((currentSets * currentRepsMax) / nextSets));

    return capDecision(
      {
        action: "split_volume",
        nextSets,
        nextReps: String(splitReps),
        reasonCode: "cardio_limited_not_muscle_limited"
      },
      input
    );
  }

  if ((latest.difficulty ?? 0) >= 8) {
    return capDecision(
      {
        action: "maintain",
        nextSets: currentSets,
        nextReps: currentReps,
        reasonCode: "high_difficulty"
      },
      input
    );
  }

  if (completedAllTargetSets(latest, currentSets, currentRepsMax) && (latest.difficulty ?? 10) <= 6) {
    return capDecision(
      {
        action: "increase",
        nextSets: currentSets,
        nextReps: repsLabel(currentRepsMin + 1, currentRepsMax + 1),
        reasonCode: "completed_easy"
      },
      input
    );
  }

  return capDecision(
    {
      action: "maintain",
      nextSets: currentSets,
      nextReps: currentReps,
      reasonCode: "high_difficulty"
    },
    input
  );
}
