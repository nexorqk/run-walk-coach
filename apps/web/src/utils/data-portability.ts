import {
  type UserProfile,
  type WorkoutTemplate
} from "@run-walk-coach/shared";
import type { z } from "zod";
import { db, type LocalWorkoutSession } from "../db/local-db.js";
import { getStoredLanguage, setStoredLanguage } from "./language.js";
import {
  BrowserDataImportSchema,
  normalizeImportedSession,
  type ImportedSyncStatus
} from "./session-import.js";
import {
  LOCAL_PROFILE_KEY,
  LOCAL_TEMPLATES_KEY,
  READINESS_CHECK_KEY,
  WEEKLY_PLAN_COMPLETION_KEY,
  WEEKLY_RUN_TARGET_KEY
} from "./storage-keys.js";
import { getStoredTheme, setStoredTheme } from "./theme.js";

type ImportedData = z.infer<typeof BrowserDataImportSchema>;

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
    weeklyPlanCompletion?: Record<string, boolean>;
    weeklyRunTarget?: 2 | 3;
    readinessChecks?: Record<string, unknown>;
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

function getStoredWeeklyRunTarget() {
  try {
    const value = localStorage.getItem(WEEKLY_RUN_TARGET_KEY);
    return value === "2" || value === "3" ? (Number(value) as 2 | 3) : undefined;
  } catch {
    return undefined;
  }
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
      theme: getStoredTheme(),
      weeklyPlanCompletion: readStoredJson<Record<string, boolean>>(WEEKLY_PLAN_COMPLETION_KEY),
      weeklyRunTarget: getStoredWeeklyRunTarget(),
      readinessChecks: readStoredJson<Record<string, unknown>>(READINESS_CHECK_KEY)
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
      theme: getStoredTheme(),
      weeklyPlanCompletion: readStoredJson<Record<string, boolean>>(WEEKLY_PLAN_COMPLETION_KEY),
      weeklyRunTarget: getStoredWeeklyRunTarget(),
      readinessChecks: readStoredJson<Record<string, unknown>>(READINESS_CHECK_KEY)
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

export async function clearBrowserProgressData() {
  await db.sessions.clear();
  localStorage.removeItem(LOCAL_PROFILE_KEY);
  localStorage.removeItem(LOCAL_TEMPLATES_KEY);
  localStorage.removeItem(WEEKLY_PLAN_COMPLETION_KEY);
  localStorage.removeItem(WEEKLY_RUN_TARGET_KEY);
  localStorage.removeItem(READINESS_CHECK_KEY);
  sessionStorage.removeItem("workoutDraft");
}

export async function importBrowserDataExport(
  rawText: string,
  syncStatus: ImportedSyncStatus
): Promise<ImportBrowserDataResult> {
  const parsed = parseImportPayload(rawText);
  const sessions = (parsed.sessions ?? []).map((session) => normalizeImportedSession(session, syncStatus));

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

  if (parsed.preferences?.weeklyPlanCompletion) {
    localStorage.setItem(WEEKLY_PLAN_COMPLETION_KEY, JSON.stringify(parsed.preferences.weeklyPlanCompletion));
  } else {
    localStorage.removeItem(WEEKLY_PLAN_COMPLETION_KEY);
  }

  if (parsed.preferences?.weeklyRunTarget) {
    localStorage.setItem(WEEKLY_RUN_TARGET_KEY, String(parsed.preferences.weeklyRunTarget));
  } else {
    localStorage.removeItem(WEEKLY_RUN_TARGET_KEY);
  }

  if (parsed.preferences?.readinessChecks) {
    localStorage.setItem(READINESS_CHECK_KEY, JSON.stringify(parsed.preferences.readinessChecks));
  } else {
    localStorage.removeItem(READINESS_CHECK_KEY);
  }

  return {
    sessionsImported: sessions.length,
    templatesImported: parsed.templates?.length ?? 0,
    hasProfile: parsed.profile !== null && parsed.profile !== undefined
  };
}
