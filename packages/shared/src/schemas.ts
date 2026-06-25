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
  difficulty: z.number().int().min(1).max(10),
  breathing: BreathingLevelSchema,
  pain: PainTypeSchema,
  notes: z.string().max(2000).nullable().optional()
});

export const UpdateWorkoutSessionSchema = CreateWorkoutSessionSchema.pick({
  date: true,
  completed: true,
  avgHr: true,
  maxHr: true,
  difficulty: true,
  breathing: true,
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
export type ProgressionResponse = z.infer<typeof ProgressionResponseSchema>;
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
