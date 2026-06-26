import type { WorkoutType } from "./schemas.js";

export const DEFAULT_USER_PROFILE = {
  heightCm: 185,
  goalSpeedKmh: 12,
  easyHrMin: 130,
  easyHrMax: 150
} as const;

export type DefaultWorkoutTemplate = {
  name: string;
  level: number;
  type: WorkoutType;
  warmupSec: number;
  runSec: number;
  walkSec: number;
  repeats: number;
  cooldownSec: number;
  isDefault: true;
};

export type DefaultExercise = {
  slug: string;
  name: string;
  category: string;
  movementPattern: string;
  equipment: string;
  difficulty: number;
};

export type DefaultStrengthWorkoutExercise = {
  exerciseSlug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  sortOrder: number;
};

export type DefaultStrengthWorkoutTemplate = {
  code: string;
  name: string;
  isDefault: true;
  exercises: DefaultStrengthWorkoutExercise[];
};

export type DefaultExerciseAlternative = {
  exerciseSlug: string;
  alternativeExerciseSlug: string;
  reason: string;
  difficultyDelta: number;
};

const warmupSec = 600;
const cooldownSec = 300;

export const DEFAULT_WORKOUT_TEMPLATES: DefaultWorkoutTemplate[] = [
  {
    name: "Level 1 - 30 sec run / 90 sec walk",
    level: 1,
    type: "RUN_WALK",
    warmupSec,
    runSec: 30,
    walkSec: 90,
    repeats: 12,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 2 - 45 sec run / 90 sec walk",
    level: 2,
    type: "RUN_WALK",
    warmupSec,
    runSec: 45,
    walkSec: 90,
    repeats: 12,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 3 - 60 sec run / 120 sec walk",
    level: 3,
    type: "RUN_WALK",
    warmupSec,
    runSec: 60,
    walkSec: 120,
    repeats: 10,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 4 - 60 sec run / 90 sec walk",
    level: 4,
    type: "RUN_WALK",
    warmupSec,
    runSec: 60,
    walkSec: 90,
    repeats: 10,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 5 - 90 sec run / 120 sec walk",
    level: 5,
    type: "RUN_WALK",
    warmupSec,
    runSec: 90,
    walkSec: 120,
    repeats: 8,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 6 - 120 sec run / 120 sec walk",
    level: 6,
    type: "RUN_WALK",
    warmupSec,
    runSec: 120,
    walkSec: 120,
    repeats: 8,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 7 - 180 sec run / 120 sec walk",
    level: 7,
    type: "RUN_WALK",
    warmupSec,
    runSec: 180,
    walkSec: 120,
    repeats: 6,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 8 - 300 sec run / 120 sec walk",
    level: 8,
    type: "RUN_WALK",
    warmupSec,
    runSec: 300,
    walkSec: 120,
    repeats: 4,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 9 - 600 sec run / 120 sec walk",
    level: 9,
    type: "RUN_WALK",
    warmupSec,
    runSec: 600,
    walkSec: 120,
    repeats: 3,
    cooldownSec,
    isDefault: true
  },
  {
    name: "Level 10 - 30 min easy run",
    level: 10,
    type: "EASY_RUN",
    warmupSec,
    runSec: 1800,
    walkSec: 0,
    repeats: 1,
    cooldownSec,
    isDefault: true
  }
];

export const DEFAULT_STRENGTH_EXERCISES: DefaultExercise[] = [
  {
    slug: "pull_up",
    name: "Pull-up",
    category: "strength",
    movementPattern: "vertical_pull",
    equipment: "pull_up_bar",
    difficulty: 4
  },
  {
    slug: "reverse_grip_pull_up",
    name: "Reverse-grip pull-up",
    category: "strength",
    movementPattern: "vertical_pull",
    equipment: "pull_up_bar",
    difficulty: 4
  },
  {
    slug: "push_up",
    name: "Push-up",
    category: "strength",
    movementPattern: "horizontal_push",
    equipment: "bodyweight",
    difficulty: 2
  },
  {
    slug: "deep_squat",
    name: "Deep squat",
    category: "strength",
    movementPattern: "squat",
    equipment: "bodyweight",
    difficulty: 2
  },
  {
    slug: "dead_bug",
    name: "Dead bug",
    category: "core",
    movementPattern: "anti_extension",
    equipment: "bodyweight",
    difficulty: 1
  },
  {
    slug: "plank",
    name: "Plank",
    category: "core",
    movementPattern: "anti_extension",
    equipment: "bodyweight",
    difficulty: 2
  },
  {
    slug: "bird_dog",
    name: "Bird dog",
    category: "core",
    movementPattern: "anti_rotation",
    equipment: "bodyweight",
    difficulty: 1
  },
  {
    slug: "kettlebell_deadlift",
    name: "Kettlebell deadlift",
    category: "strength",
    movementPattern: "hinge",
    equipment: "kettlebell",
    difficulty: 2
  },
  {
    slug: "kettlebell_row",
    name: "Kettlebell row",
    category: "strength",
    movementPattern: "horizontal_pull",
    equipment: "kettlebell",
    difficulty: 2
  },
  {
    slug: "romanian_deadlift",
    name: "Romanian deadlift",
    category: "strength",
    movementPattern: "hinge",
    equipment: "kettlebell",
    difficulty: 3
  },
  {
    slug: "goblet_squat",
    name: "Goblet squat",
    category: "strength",
    movementPattern: "squat",
    equipment: "kettlebell",
    difficulty: 3
  }
];

export const DEFAULT_STRENGTH_WORKOUT_TEMPLATES: DefaultStrengthWorkoutTemplate[] = [
  {
    code: "strength_a",
    name: "Strength A",
    isDefault: true,
    exercises: [
      { exerciseSlug: "pull_up", sets: 3, repsMin: 3, repsMax: 6, restSeconds: 150, sortOrder: 1 },
      { exerciseSlug: "push_up", sets: 3, repsMin: 8, repsMax: 15, restSeconds: 90, sortOrder: 2 },
      { exerciseSlug: "deep_squat", sets: 3, repsMin: 15, repsMax: 20, restSeconds: 90, sortOrder: 3 },
      { exerciseSlug: "dead_bug", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60, sortOrder: 4 }
    ]
  },
  {
    code: "strength_b",
    name: "Strength B",
    isDefault: true,
    exercises: [
      { exerciseSlug: "reverse_grip_pull_up", sets: 2, repsMin: 2, repsMax: 4, restSeconds: 150, sortOrder: 1 },
      { exerciseSlug: "push_up", sets: 3, repsMin: 8, repsMax: 15, restSeconds: 90, sortOrder: 2 },
      { exerciseSlug: "deep_squat", sets: 3, repsMin: 15, repsMax: 20, restSeconds: 90, sortOrder: 3 },
      { exerciseSlug: "dead_bug", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 60, sortOrder: 4 }
    ]
  },
  {
    code: "kettlebell_b",
    name: "Kettlebell B",
    isDefault: true,
    exercises: [
      { exerciseSlug: "kettlebell_deadlift", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, sortOrder: 1 },
      { exerciseSlug: "kettlebell_row", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, sortOrder: 2 },
      { exerciseSlug: "romanian_deadlift", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120, sortOrder: 3 },
      { exerciseSlug: "goblet_squat", sets: 2, repsMin: 8, repsMax: 10, restSeconds: 120, sortOrder: 4 }
    ]
  }
];

export const DEFAULT_EXERCISE_ALTERNATIVES: DefaultExerciseAlternative[] = [
  {
    exerciseSlug: "plank",
    alternativeExerciseSlug: "dead_bug",
    reason: "core_stability_lower_back_friendly",
    difficultyDelta: -1
  },
  {
    exerciseSlug: "plank",
    alternativeExerciseSlug: "bird_dog",
    reason: "low_load_core_control",
    difficultyDelta: -2
  }
];
