import type { WorkoutTemplate } from "./schemas.js";

export const workoutPhaseValues = ["WARMUP", "RUN", "WALK", "COOLDOWN", "DONE"] as const;

export type WorkoutPhase = (typeof workoutPhaseValues)[number];
export type ActiveWorkoutPhase = Exclude<WorkoutPhase, "DONE">;

export type WorkoutTimelineStep = {
  phase: ActiveWorkoutPhase;
  durationSec: number;
  repeatIndex?: number;
};

export type WorkoutTimeline = {
  steps: WorkoutTimelineStep[];
  totalDurationSec: number;
  totalRunSec: number;
  totalWalkSec: number;
  totalRepeats: number;
};

export type WorkoutTimerState = {
  phase: WorkoutPhase;
  remainingSec: number;
  elapsedSec: number;
  phaseElapsedSec: number;
  phaseDurationSec: number;
  repeatIndex?: number;
  totalRepeats: number;
  nextPhase: WorkoutPhase;
  isDone: boolean;
};

export type TimerTemplate = Pick<
  WorkoutTemplate,
  "warmupSec" | "runSec" | "walkSec" | "repeats" | "cooldownSec"
>;

export function buildWorkoutTimeline(template: TimerTemplate): WorkoutTimeline {
  const steps: WorkoutTimelineStep[] = [];

  if (template.warmupSec > 0) {
    steps.push({ phase: "WARMUP", durationSec: template.warmupSec });
  }

  for (let repeatIndex = 1; repeatIndex <= template.repeats; repeatIndex += 1) {
    if (template.runSec > 0) {
      steps.push({ phase: "RUN", durationSec: template.runSec, repeatIndex });
    }

    if (template.walkSec > 0) {
      steps.push({ phase: "WALK", durationSec: template.walkSec, repeatIndex });
    }
  }

  if (template.cooldownSec > 0) {
    steps.push({ phase: "COOLDOWN", durationSec: template.cooldownSec });
  }

  return {
    steps,
    totalDurationSec: steps.reduce((sum, step) => sum + step.durationSec, 0),
    totalRunSec: steps
      .filter((step) => step.phase === "RUN")
      .reduce((sum, step) => sum + step.durationSec, 0),
    totalWalkSec: steps
      .filter((step) => step.phase === "WALK")
      .reduce((sum, step) => sum + step.durationSec, 0),
    totalRepeats: template.repeats
  };
}

export function getWorkoutStateAtElapsedMs(
  timeline: WorkoutTimeline,
  elapsedMs: number
): WorkoutTimerState {
  const elapsedSecExact = Math.max(0, elapsedMs / 1000);
  const totalSec = timeline.totalDurationSec;

  if (timeline.steps.length === 0 || elapsedSecExact >= totalSec) {
    return {
      phase: "DONE",
      remainingSec: 0,
      elapsedSec: totalSec,
      phaseElapsedSec: 0,
      phaseDurationSec: 0,
      totalRepeats: timeline.totalRepeats,
      nextPhase: "DONE",
      isDone: true
    };
  }

  let cursorSec = 0;

  for (let index = 0; index < timeline.steps.length; index += 1) {
    const step = timeline.steps[index];
    const stepEndSec = cursorSec + step.durationSec;

    if (elapsedSecExact < stepEndSec) {
      const phaseElapsedExact = elapsedSecExact - cursorSec;
      const remainingExact = step.durationSec - phaseElapsedExact;
      const nextStep = timeline.steps[index + 1];

      return {
        phase: step.phase,
        remainingSec: Math.max(0, Math.ceil(remainingExact)),
        elapsedSec: Math.floor(elapsedSecExact),
        phaseElapsedSec: Math.floor(phaseElapsedExact),
        phaseDurationSec: step.durationSec,
        repeatIndex: step.repeatIndex,
        totalRepeats: timeline.totalRepeats,
        nextPhase: nextStep?.phase ?? "DONE",
        isDone: false
      };
    }

    cursorSec = stepEndSec;
  }

  return {
    phase: "DONE",
    remainingSec: 0,
    elapsedSec: totalSec,
    phaseElapsedSec: 0,
    phaseDurationSec: 0,
    totalRepeats: timeline.totalRepeats,
    nextPhase: "DONE",
    isDone: true
  };
}

export function getWorkoutTotalsAtElapsedMs(timeline: WorkoutTimeline, elapsedMs: number) {
  const elapsedSecExact = Math.min(Math.max(0, elapsedMs / 1000), timeline.totalDurationSec);
  let cursorSec = 0;
  let totalRunSec = 0;
  let totalWalkSec = 0;

  for (const step of timeline.steps) {
    const remainingInWorkout = elapsedSecExact - cursorSec;

    if (remainingInWorkout <= 0) {
      break;
    }

    const contributedSec = Math.min(step.durationSec, remainingInWorkout);

    if (step.phase === "RUN") {
      totalRunSec += contributedSec;
    }

    if (step.phase === "WALK") {
      totalWalkSec += contributedSec;
    }

    cursorSec += step.durationSec;
  }

  return {
    totalDurationSec: Math.floor(elapsedSecExact),
    totalRunSec: Math.floor(totalRunSec),
    totalWalkSec: Math.floor(totalWalkSec)
  };
}

export function formatTime(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
