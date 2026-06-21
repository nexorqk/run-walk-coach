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
