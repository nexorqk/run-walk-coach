import Dexie, { type Table } from "dexie";
import type { BreathingLevel, PainType } from "@run-walk-coach/shared";

export type SyncStatus = "local" | "pending" | "synced" | "failed";

export type LocalWorkoutSession = {
  localId: string;
  remoteId?: string;
  syncStatus: SyncStatus;
  templateId?: string | null;
  templateName?: string;
  templateLevel?: number;
  date: string;
  completed: boolean;
  totalDurationSec: number;
  totalRunSec: number;
  totalWalkSec: number;
  avgHr?: number | null;
  maxHr?: number | null;
  difficulty: number;
  breathing: BreathingLevel;
  pain: PainType;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

class RunWalkCoachDb extends Dexie {
  sessions!: Table<LocalWorkoutSession, string>;

  constructor() {
    super("runWalkCoach");

    this.version(1).stores({
      sessions: "localId, remoteId, syncStatus, date, templateId"
    });
  }
}

export const db = new RunWalkCoachDb();
