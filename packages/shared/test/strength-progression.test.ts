import { describe, expect, it } from "vitest";
import { decideStrengthProgression, type StrengthProgressionInput } from "../src/strength-progression.js";

function input(overrides: Partial<StrengthProgressionInput> = {}): StrengthProgressionInput {
  return {
    exercise: {
      slug: "push_up",
      name: "Push-up"
    },
    currentSets: 3,
    currentRepsMin: 8,
    currentRepsMax: 12,
    lastPerformances: [
      {
        difficulty: 5,
        sets: [
          { reps: 12, completed: true },
          { reps: 12, completed: true },
          { reps: 12, completed: true }
        ],
        feedback: {
          pain: "NONE"
        }
      }
    ],
    ...overrides
  };
}

describe("decideStrengthProgression", () => {
  it("increases reps after an easy completed performance", () => {
    const decision = decideStrengthProgression(input());

    expect(decision).toMatchObject({
      action: "increase",
      nextSets: 3,
      nextReps: "9-13",
      reasonCode: "completed_easy"
    });
  });

  it("decreases sets when pain is reported", () => {
    const decision = decideStrengthProgression(
      input({
        lastPerformances: [
          {
            difficulty: 4,
            sets: [
              { reps: 12, completed: true },
              { reps: 12, completed: true },
              { reps: 10, completed: true }
            ],
            feedback: {
              pain: "BACK"
            }
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      action: "decrease",
      nextSets: 2,
      nextReps: "8-12",
      reasonCode: "pain_detected"
    });
  });

  it("maintains load when the latest effort was high", () => {
    const decision = decideStrengthProgression(
      input({
        lastPerformances: [
          {
            difficulty: 8,
            sets: [
              { reps: 12, completed: true },
              { reps: 11, completed: true },
              { reps: 10, completed: true }
            ],
            feedback: {
              pain: "NONE"
            }
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      action: "maintain",
      nextSets: 3,
      nextReps: "8-12",
      reasonCode: "high_difficulty"
    });
  });

  it("splits deep-squat volume when breathing is the limiter", () => {
    const decision = decideStrengthProgression(
      input({
        exercise: {
          slug: "deep_squat",
          name: "Deep squat"
        },
        currentSets: 3,
        currentRepsMin: 20,
        currentRepsMax: 20,
        lastPerformances: [
          {
            difficulty: 7,
            sets: [
              { reps: 20, completed: true },
              { reps: 20, completed: true },
              { reps: 20, completed: true }
            ],
            feedback: {
              breathingDifficulty: 9,
              muscleDifficulty: 4,
              pain: "NONE"
            }
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      action: "split_volume",
      nextSets: 4,
      nextReps: "15",
      reasonCode: "cardio_limited_not_muscle_limited"
    });
  });

  it("substitutes an excluded exercise", () => {
    const decision = decideStrengthProgression(
      input({
        exercise: {
          slug: "plank",
          name: "Plank"
        },
        userRules: [
          {
            type: "exercise_exclusion",
            priority: 100,
            payload: {
              exercise: "plank",
              replacement: "dead_bug"
            }
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      action: "substitute",
      nextSets: 3,
      nextReps: "8-12",
      reasonCode: "exercise_excluded",
      replacementSlug: "dead_bug"
    });
  });

  it("applies exercise constraints after the base progression decision", () => {
    const decision = decideStrengthProgression(
      input({
        exercise: {
          slug: "reverse_grip_pull_up",
          name: "Reverse-grip pull-up"
        },
        currentSets: 3,
        currentRepsMin: 3,
        currentRepsMax: 5,
        userRules: [
          {
            type: "exercise_constraint",
            priority: 80,
            payload: {
              exercise: "reverse_grip_pull_up",
              maxSets: 2,
              maxRepsPerSet: 3
            }
          }
        ]
      })
    );

    expect(decision).toMatchObject({
      action: "increase",
      nextSets: 2,
      nextReps: "3",
      reasonCode: "exercise_constraint_applied"
    });
  });
});
