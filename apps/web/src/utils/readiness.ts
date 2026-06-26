import type { PainType } from "@run-walk-coach/shared";

export type ReadinessIllness = "none" | "above_neck" | "below_neck" | "fever";
export type ReadinessAction = "run" | "easy" | "walk" | "rest" | "medical";
export type ReadinessReason =
  | "red-flags"
  | "fever"
  | "below-neck"
  | "pain"
  | "soreness"
  | "fatigue"
  | "sleep"
  | "stress"
  | "ready";

export type ReadinessCheckInput = {
  sleepQuality: number;
  fatigue: number;
  stress: number;
  soreness: number;
  pain: PainType;
  illness: ReadinessIllness;
  redFlags: boolean;
};

export type ReadinessResult = {
  score: number;
  action: ReadinessAction;
  reasons: ReadinessReason[];
};

export const defaultReadinessCheck: ReadinessCheckInput = {
  sleepQuality: 4,
  fatigue: 2,
  stress: 2,
  soreness: 1,
  pain: "NONE",
  illness: "none",
  redFlags: false
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function evaluateReadiness(input: ReadinessCheckInput): ReadinessResult {
  if (input.redFlags) {
    return {
      score: 0,
      action: "medical",
      reasons: ["red-flags"]
    };
  }

  const reasons: ReadinessReason[] = [];
  let score = 100;

  if (input.illness === "fever") {
    return {
      score: 10,
      action: "rest",
      reasons: ["fever"]
    };
  }

  if (input.illness === "below_neck") {
    score -= 55;
    reasons.push("below-neck");
  } else if (input.illness === "above_neck") {
    score -= 20;
  }

  if (input.pain !== "NONE") {
    score -= 35;
    reasons.push("pain");
  }

  if (input.soreness >= 4) {
    score -= 25;
    reasons.push("soreness");
  } else if (input.soreness >= 3) {
    score -= 12;
    reasons.push("soreness");
  }

  if (input.fatigue >= 4) {
    score -= 25;
    reasons.push("fatigue");
  } else if (input.fatigue >= 3) {
    score -= 10;
    reasons.push("fatigue");
  }

  if (input.sleepQuality <= 2) {
    score -= 20;
    reasons.push("sleep");
  } else if (input.sleepQuality === 3) {
    score -= 8;
  }

  if (input.stress >= 4) {
    score -= 14;
    reasons.push("stress");
  } else if (input.stress >= 3) {
    score -= 6;
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);

  if (input.illness === "below_neck" || (input.pain !== "NONE" && input.soreness >= 3)) {
    return {
      score: normalizedScore,
      action: "rest",
      reasons: unique(reasons)
    };
  }

  if (normalizedScore < 45) {
    return {
      score: normalizedScore,
      action: "walk",
      reasons: unique(reasons)
    };
  }

  if (normalizedScore < 75) {
    return {
      score: normalizedScore,
      action: "easy",
      reasons: unique(reasons)
    };
  }

  return {
    score: normalizedScore,
    action: "run",
    reasons: reasons.length > 0 ? unique(reasons) : ["ready"]
  };
}
