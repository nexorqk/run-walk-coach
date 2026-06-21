import type { BreathingLevel, PainType, WorkoutPhase } from "@run-walk-coach/shared";

export function phaseLabel(phase: WorkoutPhase) {
  switch (phase) {
    case "WARMUP":
      return "WARMUP";
    case "RUN":
      return "RUN";
    case "WALK":
      return "WALK";
    case "COOLDOWN":
      return "COOLDOWN";
    case "DONE":
      return "DONE";
  }
}

export function breathingLabel(value: BreathingLevel) {
  switch (value) {
    case "EASY":
      return "Easy";
    case "MEDIUM":
      return "Medium";
    case "HARD":
      return "Hard";
    case "VERY_HARD":
      return "Very hard";
  }
}

export function painLabel(value: PainType) {
  switch (value) {
    case "NONE":
      return "None";
    case "SHIN":
      return "Shin";
    case "KNEE":
      return "Knee";
    case "ACHILLES":
      return "Achilles";
    case "FOOT":
      return "Foot";
    case "HIP":
      return "Hip";
    case "BACK":
      return "Back";
    case "OTHER":
      return "Other";
  }
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
