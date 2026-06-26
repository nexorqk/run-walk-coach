import {
  BreathingLevelSchema,
  HeartRateZoneSchema,
  PainTypeSchema,
  UserProfileSchema,
  WorkoutTemplateSchema
} from "@run-walk-coach/shared";
import { z } from "zod";
import type { LocalWorkoutSession, SyncStatus } from "../db/local-db.js";

const SyncStatusSchema = z.enum(["local", "pending", "synced", "failed"]);
const AppLanguageSchema = z.enum(["en", "ru"]);
const AppThemeSchema = z.enum(["light", "dark", "system"]);
const ReadinessIllnessSchema = z.enum(["none", "above_neck", "below_neck", "fever"]);

export const ImportedSessionSchema = z.object({
  localId: z.string().min(1).optional(),
  remoteId: z.string().min(1).nullable().optional(),
  syncStatus: SyncStatusSchema.optional(),
  id: z.string().min(1).optional(),
  templateId: z.string().nullable().optional(),
  templateName: z.string().optional(),
  templateLevel: z.number().int().min(1).optional(),
  template: WorkoutTemplateSchema.nullable().optional(),
  date: z.string(),
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
  breathingNote: z.string().nullable().optional(),
  pain: PainTypeSchema,
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const BrowserDataImportSchema = z.object({
  app: z.string().optional(),
  version: z.number().int().positive().optional(),
  exportedAt: z.string().optional(),
  profile: UserProfileSchema.nullable().optional(),
  templates: z.array(WorkoutTemplateSchema).optional(),
  sessions: z.array(ImportedSessionSchema).optional(),
  preferences: z
    .object({
      language: AppLanguageSchema.optional(),
      theme: AppThemeSchema.optional(),
      weeklyPlanCompletion: z.record(z.boolean()).optional(),
      weeklyRunTarget: z.union([z.literal(2), z.literal(3)]).optional(),
      readinessChecks: z
        .record(
          z.object({
            sleepQuality: z.number().int().min(1).max(5),
            fatigue: z.number().int().min(1).max(5),
            stress: z.number().int().min(1).max(5),
            soreness: z.number().int().min(1).max(5),
            pain: PainTypeSchema,
            illness: ReadinessIllnessSchema,
            redFlags: z.boolean()
          })
        )
        .optional()
    })
    .optional()
});

export type ImportedSession = z.infer<typeof ImportedSessionSchema>;
export type ImportedSyncStatus = Extract<SyncStatus, "local" | "pending">;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeImportedSession(
  session: ImportedSession,
  requestedSyncStatus: ImportedSyncStatus,
  createId: () => string = () => crypto.randomUUID()
): LocalWorkoutSession {
  const now = new Date().toISOString();
  const remoteId = session.remoteId ?? (!session.localId && session.id ? session.id : undefined);
  const shouldKeepSynced = requestedSyncStatus === "pending" && remoteId !== undefined;
  const syncStatus: SyncStatus = shouldKeepSynced ? "synced" : requestedSyncStatus;
  const importedLocalId = session.localId ?? session.id;
  let localId = importedLocalId ?? createId();

  if (shouldKeepSynced && !session.localId) {
    localId = createId();
  } else if (syncStatus === "pending" && !isUuid(localId)) {
    localId = createId();
  }

  return {
    localId,
    remoteId: remoteId ?? undefined,
    syncStatus,
    templateId: session.templateId ?? session.template?.id ?? null,
    templateName: session.templateName ?? session.template?.name,
    templateLevel: session.templateLevel ?? session.template?.level,
    date: session.date,
    completed: session.completed,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    totalWalkSec: session.totalWalkSec,
    avgHr: session.avgHr ?? null,
    maxHr: session.maxHr ?? null,
    stopwatchPulseBpm: session.stopwatchPulseBpm ?? null,
    heartRateZone: session.heartRateZone ?? null,
    distanceMeters: session.distanceMeters ?? null,
    avgPaceSecPerKm: session.avgPaceSecPerKm ?? null,
    avgSpeedKmh: session.avgSpeedKmh ?? null,
    cadenceSpm: session.cadenceSpm ?? null,
    difficulty: session.difficulty,
    breathing: session.breathing,
    breathingNote: session.breathingNote ?? null,
    pain: session.pain,
    notes: session.notes ?? null,
    createdAt: session.createdAt ?? now,
    updatedAt: now
  };
}
