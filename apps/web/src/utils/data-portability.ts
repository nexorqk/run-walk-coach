import {
  BreathingLevelSchema,
  PainTypeSchema,
  UserProfileSchema,
  WorkoutTemplateSchema,
  type UserProfile,
  type WorkoutTemplate
} from "@run-walk-coach/shared";
import { z } from "zod";
import { db, type LocalWorkoutSession, type SyncStatus } from "../db/local-db.js";
import { getStoredLanguage, setStoredLanguage } from "./language.js";
import { LOCAL_PROFILE_KEY, LOCAL_TEMPLATES_KEY } from "./storage-keys.js";
import { getStoredTheme, setStoredTheme } from "./theme.js";

const SyncStatusSchema = z.enum(["local", "pending", "synced", "failed"]);
const AppLanguageSchema = z.enum(["en", "ru"]);
const AppThemeSchema = z.enum(["light", "dark", "system"]);

const ImportedSessionSchema = z.object({
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

const BrowserDataImportSchema = z.object({
  app: z.string().optional(),
  version: z.number().int().positive().optional(),
  exportedAt: z.string().optional(),
  profile: UserProfileSchema.nullable().optional(),
  templates: z.array(WorkoutTemplateSchema).optional(),
  sessions: z.array(ImportedSessionSchema).optional(),
  preferences: z
    .object({
      language: AppLanguageSchema.optional(),
      theme: AppThemeSchema.optional()
    })
    .optional()
});

type ImportedSession = z.infer<typeof ImportedSessionSchema>;
type ImportedData = z.infer<typeof BrowserDataImportSchema>;
type ImportedSyncStatus = Extract<SyncStatus, "local" | "pending">;

export type BrowserDataExport = {
  app: "run-walk-coach";
  version: 1;
  exportedAt: string;
  profile: UserProfile | null;
  templates: WorkoutTemplate[];
  sessions: LocalWorkoutSession[];
  preferences: {
    language: ReturnType<typeof getStoredLanguage>;
    theme: ReturnType<typeof getStoredTheme>;
  };
};

export type ImportBrowserDataResult = {
  sessionsImported: number;
  templatesImported: number;
  hasProfile: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStoredJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeSession(session: ImportedSession, syncStatus: ImportedSyncStatus): LocalWorkoutSession {
  const now = new Date().toISOString();
  const localId = session.localId ?? session.id ?? crypto.randomUUID();

  return {
    localId,
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

function parseImportPayload(rawText: string): ImportedData {
  let raw: unknown;

  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error("Invalid JSON file");
  }

  return BrowserDataImportSchema.parse(raw);
}

export async function buildBrowserDataExport(
  profile?: UserProfile,
  templates: WorkoutTemplate[] = []
): Promise<BrowserDataExport> {
  const storedProfile = readStoredJson<UserProfile>(LOCAL_PROFILE_KEY);
  const storedTemplates = readStoredJson<WorkoutTemplate[]>(LOCAL_TEMPLATES_KEY);
  const sessions = await db.sessions.orderBy("date").reverse().toArray();

  return {
    app: "run-walk-coach",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ?? storedProfile ?? null,
    templates: templates.length > 0 ? templates : storedTemplates ?? [],
    sessions,
    preferences: {
      language: getStoredLanguage(),
      theme: getStoredTheme()
    }
  };
}

export function withExportPreferences(data: unknown, source: "browser" | "server") {
  const base = isRecord(data) ? data : { payload: data };
  const existingPreferences = isRecord(base.preferences) ? base.preferences : {};
  const exportedAt = typeof base.exportedAt === "string" ? base.exportedAt : new Date().toISOString();

  return {
    ...base,
    app: "run-walk-coach",
    version: 1,
    source,
    exportedAt,
    preferences: {
      ...existingPreferences,
      language: getStoredLanguage(),
      theme: getStoredTheme()
    }
  };
}

export function countExportedSessions(data: unknown) {
  return isRecord(data) && Array.isArray(data.sessions) ? data.sessions.length : 0;
}

export function downloadJsonBackup(data: unknown, exportedAt = new Date().toISOString()) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = exportedAt.replace(/[:.]/g, "-");

  link.href = url;
  link.download = `run-walk-coach-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBrowserDataExport(data: BrowserDataExport) {
  downloadJsonBackup(data, data.exportedAt);
}

export async function importBrowserDataExport(
  rawText: string,
  syncStatus: ImportedSyncStatus
): Promise<ImportBrowserDataResult> {
  const parsed = parseImportPayload(rawText);
  const sessions = (parsed.sessions ?? []).map((session) => normalizeSession(session, syncStatus));

  await db.transaction("rw", db.sessions, async () => {
    await db.sessions.clear();

    if (sessions.length > 0) {
      await db.sessions.bulkPut(sessions);
    }
  });

  if (parsed.profile) {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(parsed.profile));
  } else {
    localStorage.removeItem(LOCAL_PROFILE_KEY);
  }

  if (parsed.templates && parsed.templates.length > 0) {
    localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(parsed.templates));
  } else {
    localStorage.removeItem(LOCAL_TEMPLATES_KEY);
  }

  if (parsed.preferences?.language) {
    setStoredLanguage(parsed.preferences.language);
  }

  if (parsed.preferences?.theme) {
    setStoredTheme(parsed.preferences.theme);
  }

  return {
    sessionsImported: sessions.length,
    templatesImported: parsed.templates?.length ?? 0,
    hasProfile: parsed.profile !== null && parsed.profile !== undefined
  };
}
