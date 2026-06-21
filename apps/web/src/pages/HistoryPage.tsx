import { formatTime, type WorkoutSession } from "@run-walk-coach/shared";
import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getSessions } from "../api/client.js";
import { db, type LocalWorkoutSession, type SyncStatus } from "../db/local-db.js";
import { retryPendingSessions } from "../sync/sync-sessions.js";
import { formatDateTime, painLabel } from "../utils/labels.js";

type HistoryItem = {
  key: string;
  date: string;
  templateName: string;
  templateLevel?: number;
  totalDurationSec: number;
  totalRunSec: number;
  difficulty: number;
  maxHr?: number | null;
  pain: string;
  syncStatus: SyncStatus;
};

function localToHistory(session: LocalWorkoutSession): HistoryItem {
  return {
    key: session.localId,
    date: session.date,
    templateName: session.templateName ?? "Workout",
    templateLevel: session.templateLevel,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    maxHr: session.maxHr,
    pain: painLabel(session.pain),
    syncStatus: session.syncStatus
  };
}

function remoteToHistory(session: WorkoutSession): HistoryItem {
  return {
    key: session.id,
    date: session.date,
    templateName: session.template?.name ?? "Workout",
    templateLevel: session.template?.level,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    maxHr: session.maxHr,
    pain: painLabel(session.pain),
    syncStatus: "synced"
  };
}

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    await retryPendingSessions();
    const localSessions = await db.sessions.orderBy("date").reverse().toArray();

    try {
      const remoteSessions = await getSessions();
      const syncedRemoteIds = new Set(localSessions.map((session) => session.remoteId).filter(Boolean));
      const merged = [
        ...localSessions.map(localToHistory),
        ...remoteSessions
          .filter((session) => !syncedRemoteIds.has(session.id))
          .map(remoteToHistory)
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(merged);
    } catch {
      setItems(localSessions.map(localToHistory));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">History</div>
          <h1>Sessions</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => void load()} title="Refresh history">
          <RefreshCcw aria-hidden="true" size={24} />
        </button>
      </section>

      {isLoading ? <p className="muted">Loading sessions...</p> : null}

      {!isLoading && items.length === 0 ? (
        <section className="empty-state">
          <p>No sessions yet.</p>
        </section>
      ) : null}

      <section className="list">
        {items.map((item) => (
          <article className="session-row" key={item.key}>
            <div className="session-row-main">
              <strong>{item.templateName}</strong>
              <span>{formatDateTime(item.date)}</span>
            </div>
            <div className="session-stats">
              <span>{item.templateLevel ? `L${item.templateLevel}` : "Level -"}</span>
              <span>{formatTime(item.totalDurationSec)}</span>
              <span>Run {formatTime(item.totalRunSec)}</span>
              <span>D{item.difficulty}</span>
              <span>Max {item.maxHr ?? "-"}</span>
              <span>{item.pain}</span>
            </div>
            <span className={`sync-pill ${item.syncStatus}`}>{item.syncStatus}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
