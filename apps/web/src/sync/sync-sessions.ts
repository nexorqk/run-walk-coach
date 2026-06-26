import type { CreateWorkoutSession, WorkoutTemplate } from "@run-walk-coach/shared";
import { createSession } from "../api/client.js";
import { db, type LocalWorkoutSession } from "../db/local-db.js";

function remoteTemplateId(templateId: string | null | undefined) {
  if (!templateId || templateId.startsWith("local-")) {
    return null;
  }

  return templateId;
}

function toCreatePayload(session: LocalWorkoutSession): CreateWorkoutSession {
  return {
    clientSessionId: session.localId,
    templateId: remoteTemplateId(session.templateId),
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
    notes: session.notes ?? null
  };
}

export async function trySyncSession(session: LocalWorkoutSession) {
  await db.sessions.update(session.localId, {
    syncStatus: "pending",
    updatedAt: new Date().toISOString()
  });

  try {
    const remote = await createSession(toCreatePayload(session));
    await db.sessions.update(session.localId, {
      syncStatus: "synced",
      remoteId: remote.id,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch {
    await db.sessions.update(session.localId, {
      syncStatus: "pending",
      updatedAt: new Date().toISOString()
    });
    return false;
  }
}

export async function saveSessionOfflineFirst(
  payload: Omit<
    LocalWorkoutSession,
    "localId" | "remoteId" | "syncStatus" | "createdAt" | "updatedAt" | "templateName" | "templateLevel"
  >,
  template?: WorkoutTemplate,
  syncEnabled = false
) {
  const now = new Date().toISOString();
  const localSession: LocalWorkoutSession = {
    ...payload,
    localId: crypto.randomUUID(),
    syncStatus: syncEnabled ? "pending" : "local",
    templateName: template?.name,
    templateLevel: template?.level,
    createdAt: now,
    updatedAt: now
  };

  await db.sessions.put(localSession);

  if (syncEnabled) {
    await trySyncSession(localSession);
  }

  return db.sessions.get(localSession.localId);
}

export async function retryPendingSessions(syncEnabled = false) {
  if (!syncEnabled) {
    return;
  }

  const pending = await db.sessions.where("syncStatus").anyOf("local", "pending", "failed").toArray();

  for (const session of pending) {
    await trySyncSession(session);
  }
}
