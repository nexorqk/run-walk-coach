import {
  BreathingLevelSchema,
  PainTypeSchema,
  UserProfileSchema,
  WorkoutTemplateSchema
} from "@run-walk-coach/shared";
import { z } from "zod";
import type { LocalWorkoutSession, SyncStatus } from "../db/local-db.js";

const SyncStatusSchema = z.enum(["local", "pending", "synced", "failed"]);
const AppLanguageSchema = z.enum(["en", "ru"]);
const AppThemeSchema = z.enum(["light", "dark", "system"]);

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
  difficulty: z.number().int().min(1).max(10),
  breathing: BreathingLevelSchema,
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
      weeklyRunTarget: z.union([z.literal(2), z.literal(3)]).optional()
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
    difficulty: session.difficulty,
    breathing: session.breathing,
    pain: session.pain,
    notes: session.notes ?? null,
    createdAt: session.createdAt ?? now,
    updatedAt: now
  };
}
