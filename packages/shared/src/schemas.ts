import { z } from "zod";

export const workoutTypeValues = [
  "RUN_WALK",
  "EASY_RUN",
  "WALK",
  "BIKE",
  "STRENGTH"
] as const;

export const breathingLevelValues = [
  "EASY",
  "MEDIUM",
  "HARD",
  "VERY_HARD"
] as const;

export const heartRateZoneValues = [
  "ZONE_1",
  "ZONE_2",
  "ZONE_3",
  "ZONE_4",
  "ZONE_5"
] as const;

export const painTypeValues = [
  "NONE",
  "SHIN",
  "KNEE",
  "ACHILLES",
  "FOOT",
  "HIP",
  "BACK",
  "OTHER"
] as const;

export const progressionActionValues = ["progress", "repeat", "regress"] as const;

export const WorkoutTypeSchema = z.enum(workoutTypeValues);
export const BreathingLevelSchema = z.enum(breathingLevelValues);
export const HeartRateZoneSchema = z.enum(heartRateZoneValues);
export const PainTypeSchema = z.enum(painTypeValues);
export const ProgressionActionSchema = z.enum(progressionActionValues);

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  heightCm: z.number().int().positive(),
  goalSpeedKmh: z.number().positive(),
  easyHrMin: z.number().int().positive(),
  easyHrMax: z.number().int().positive(),
  googleLinkedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const UpdateUserProfileSchema = z
  .object({
    email: z.string().email().nullable().optional(),
    heightCm: z.number().int().min(100).max(230).optional(),
    goalSpeedKmh: z.number().min(3).max(25).optional(),
    easyHrMin: z.number().int().min(60).max(220).optional(),
    easyHrMax: z.number().int().min(60).max(230).optional()
  })
  .refine(
    (value) =>
      value.easyHrMin === undefined ||
      value.easyHrMax === undefined ||
      value.easyHrMin < value.easyHrMax,
    {
      message: "easyHrMin must be lower than easyHrMax",
      path: ["easyHrMin"]
    }
  );

export const WorkoutTemplateSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  level: z.number().int().min(1),
  type: WorkoutTypeSchema,
  warmupSec: z.number().int().min(0),
  runSec: z.number().int().min(0),
  walkSec: z.number().int().min(0),
  repeats: z.number().int().min(1),
  cooldownSec: z.number().int().min(0),
  isDefault: z.boolean(),
  createdAt: z.string()
});

export const UpdateWorkoutTemplateSchema = z
  .object({
    warmupSec: z.number().int().min(0).max(3600).optional(),
    runSec: z.number().int().min(1).max(3600).optional(),
    walkSec: z.number().int().min(0).max(3600).optional(),
    cooldownSec: z.number().int().min(0).max(3600).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one workout timing field is required"
  });

export const AuthProvidersSchema = z.object({
  google: z.object({
    enabled: z.boolean(),
    redirectUri: z.string().url()
  })
});

export const CreateWorkoutSessionSchema = z.object({
  clientSessionId: z.string().uuid().nullable().optional(),
  templateId: z.string().nullable().optional(),
  date: z.string().datetime().optional(),
  completed: z.boolean().default(true),
  totalDurationSec: z.number().int().min(0),
  totalRunSec: z.number().int().min(0),
  totalWalkSec: z.number().int().min(0),
  avgHr: z.number().int().min(30).max(240).nullable().optional(),
  maxHr: z.number().int().min(30).max(260).nullable().optional(),
  stopwatchPulseBpm: z.number().int().min(30).max(260).nullable().optional(),
  heartRateZone: HeartRateZoneSchema.nullable().optional(),
  distanceMeters: z.number().int().min(0).max(1000000).nullable().optional(),
  avgPaceSecPerKm: z.number().int().min(60).max(3600).nullable().optional(),
  avgSpeedKmh: z.number().min(0.1).max(80).nullable().optional(),
  cadenceSpm: z.number().int().min(50).max(260).nullable().optional(),
  difficulty: z.number().int().min(1).max(10),
  breathing: BreathingLevelSchema,
  breathingNote: z.string().max(500).nullable().optional(),
  pain: PainTypeSchema,
  notes: z.string().max(2000).nullable().optional()
});

export const UpdateWorkoutSessionSchema = CreateWorkoutSessionSchema.pick({
  date: true,
  completed: true,
  avgHr: true,
  maxHr: true,
  stopwatchPulseBpm: true,
  heartRateZone: true,
  distanceMeters: true,
  avgPaceSecPerKm: true,
  avgSpeedKmh: true,
  cadenceSpm: true,
  difficulty: true,
  breathing: true,
  breathingNote: true,
  pain: true,
  notes: true
}).partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one session field is required"
});

export const WorkoutSessionSchema = CreateWorkoutSessionSchema.extend({
  id: z.string(),
  userId: z.string(),
  templateId: z.string().nullable(),
  date: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  template: WorkoutTemplateSchema.nullable().optional()
});

export const ExerciseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  movementPattern: z.string(),
  equipment: z.string(),
  difficulty: z.number().int().min(1).max(5),
  createdAt: z.string()
});

export const StrengthWorkoutExerciseSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(20),
  repsMin: z.number().int().min(1).max(200),
  repsMax: z.number().int().min(1).max(200),
  restSeconds: z.number().int().min(0).max(3600),
  sortOrder: z.number().int().min(1),
  exercise: ExerciseSchema.optional()
});

export const StrengthWorkoutTemplateSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  exercises: z.array(StrengthWorkoutExerciseSchema).optional()
});

export const CreateStrengthSetLogSchema = z.object({
  exerciseId: z.string(),
  setNumber: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  completed: z.boolean().default(true)
});

export const StrengthSetLogSchema = CreateStrengthSetLogSchema.extend({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string(),
  exercise: ExerciseSchema.optional()
});

export const CreateStrengthExerciseFeedbackSchema = z.object({
  exerciseId: z.string(),
  muscleDifficulty: z.number().int().min(1).max(10).nullable().optional(),
  breathingDifficulty: z.number().int().min(1).max(10).nullable().optional(),
  pain: PainTypeSchema,
  comment: z.string().max(1000).nullable().optional()
});

export const StrengthExerciseFeedbackSchema = CreateStrengthExerciseFeedbackSchema.extend({
  id: z.string(),
  sessionId: z.string(),
  createdAt: z.string(),
  exercise: ExerciseSchema.optional()
});

export const CreateStrengthWorkoutSessionSchema = z.object({
  templateId: z.string().nullable().optional(),
  date: z.string().datetime().optional(),
  completed: z.boolean().default(true),
  durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
  difficulty: z.number().int().min(1).max(10),
  notes: z.string().max(2000).nullable().optional(),
  setLogs: z.array(CreateStrengthSetLogSchema).min(1),
  feedback: z.array(CreateStrengthExerciseFeedbackSchema).default([])
});

export const StrengthWorkoutSessionSchema = CreateStrengthWorkoutSessionSchema.extend({
  id: z.string(),
  userId: z.string(),
  templateId: z.string().nullable(),
  date: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  template: StrengthWorkoutTemplateSchema.nullable().optional(),
  setLogs: z.array(StrengthSetLogSchema).optional(),
  feedback: z.array(StrengthExerciseFeedbackSchema).optional()
});

export const UserExerciseStateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  exerciseId: z.string(),
  currentLevel: z.number().int().min(1),
  bestSetReps: z.number().int().nullable(),
  bestWeightKg: z.number().nullable(),
  bestVolume: z.number().nullable(),
  lastDifficulty: z.number().int().nullable(),
  averageDifficultyLast3: z.number().nullable(),
  lastPain: PainTypeSchema.nullable(),
  trend: z.string().nullable(),
  nextRecommendedSets: z.number().int().nullable(),
  nextRecommendedReps: z.string().nullable(),
  updatedAt: z.string(),
  exercise: ExerciseSchema.optional()
});

export const UserRuleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  payload: z.record(z.unknown()),
  priority: z.number().int(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProgressionResponseSchema = z.object({
  action: ProgressionActionSchema,
  template: WorkoutTemplateSchema,
  reason: z.string()
});

export const AnalyticsSummarySchema = z.object({
  sessionsThisWeek: z.number().int().min(0),
  totalDurationThisWeekSec: z.number().int().min(0),
  totalRunThisWeekSec: z.number().int().min(0),
  averageDifficulty: z.number().nullable(),
  currentLevel: z.number().int().min(1),
  next: ProgressionResponseSchema
});

export type WorkoutType = z.infer<typeof WorkoutTypeSchema>;
export type BreathingLevel = z.infer<typeof BreathingLevelSchema>;
export type HeartRateZone = z.infer<typeof HeartRateZoneSchema>;
export type PainType = z.infer<typeof PainTypeSchema>;
export type ProgressionAction = z.infer<typeof ProgressionActionSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;
export type UpdateWorkoutTemplate = z.infer<typeof UpdateWorkoutTemplateSchema>;
export type AuthProviders = z.infer<typeof AuthProvidersSchema>;
export type CreateWorkoutSession = z.infer<typeof CreateWorkoutSessionSchema>;
export type UpdateWorkoutSession = z.infer<typeof UpdateWorkoutSessionSchema>;
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type StrengthWorkoutExercise = z.infer<typeof StrengthWorkoutExerciseSchema>;
export type StrengthWorkoutTemplate = z.infer<typeof StrengthWorkoutTemplateSchema>;
export type CreateStrengthSetLog = z.infer<typeof CreateStrengthSetLogSchema>;
export type StrengthSetLog = z.infer<typeof StrengthSetLogSchema>;
export type CreateStrengthExerciseFeedback = z.infer<typeof CreateStrengthExerciseFeedbackSchema>;
export type StrengthExerciseFeedback = z.infer<typeof StrengthExerciseFeedbackSchema>;
export type CreateStrengthWorkoutSession = z.infer<typeof CreateStrengthWorkoutSessionSchema>;
export type StrengthWorkoutSession = z.infer<typeof StrengthWorkoutSessionSchema>;
export type UserExerciseState = z.infer<typeof UserExerciseStateSchema>;
export type UserRule = z.infer<typeof UserRuleSchema>;
export type ProgressionResponse = z.infer<typeof ProgressionResponseSchema>;
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
