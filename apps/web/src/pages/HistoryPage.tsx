import { formatTime, type WorkoutSession } from "@run-walk-coach/shared";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getSessions } from "../api/client.js";
import { db, type LocalWorkoutSession, type SyncStatus } from "../db/local-db.js";
import { retryPendingSessions } from "../sync/sync-sessions.js";
import { useAppStore } from "../store/app-store.js";
import {
  formatDateTime,
  localizeTemplateName,
  painLabel,
  syncStatusLabel,
  type AppLanguage,
  useLanguage
} from "../utils/language.js";

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

function localToHistory(session: LocalWorkoutSession, language: AppLanguage): HistoryItem {
  return {
    key: session.localId,
    date: session.date,
    templateName: localizeTemplateName(session.templateName, language),
    templateLevel: session.templateLevel,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    maxHr: session.maxHr,
    pain: painLabel(session.pain, language),
    syncStatus: session.syncStatus
  };
}

function remoteToHistory(session: WorkoutSession, language: AppLanguage): HistoryItem {
  return {
    key: session.id,
    date: session.date,
    templateName: localizeTemplateName(session.template?.name, language),
    templateLevel: session.template?.level,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    maxHr: session.maxHr,
    pain: painLabel(session.pain, language),
    syncStatus: "synced"
  };
}

export function HistoryPage() {
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const { language, t } = useLanguage();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    await retryPendingSessions(serverSyncEnabled);
    const localSessions = await db.sessions.orderBy("date").reverse().toArray();

    if (!serverSyncEnabled) {
      setItems(localSessions.map((session) => localToHistory(session, language)));
      setIsLoading(false);
      return;
    }

    try {
      const remoteSessions = await getSessions();
      const syncedRemoteIds = new Set(localSessions.map((session) => session.remoteId).filter(Boolean));
      const merged = [
        ...localSessions.map((session) => localToHistory(session, language)),
        ...remoteSessions
          .filter((session) => !syncedRemoteIds.has(session.id))
          .map((session) => remoteToHistory(session, language))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(merged);
    } catch {
      setItems(localSessions.map((session) => localToHistory(session, language)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [serverSyncEnabled, language]);

  return (
    <div className="stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">{t({ en: "History", ru: "История" })}</div>
          <h1>{t({ en: "Sessions", ru: "Тренировки" })}</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          title={t({ en: "Refresh history", ru: "Обновить историю" })}
        >
          <RefreshCcw aria-hidden="true" size={24} />
        </button>
      </section>

      {!serverSyncEnabled ? (
        <div className="warning-callout">
          <AlertTriangle aria-hidden="true" size={22} />
          <p>
            {t({
              en: "Without Google login, history is saved only in this browser. If browser storage, cache, cookies, or site data are cleared, all local progress will be deleted.",
              ru: "Без входа через Google история хранится только в этом браузере. Если очистить память браузера, кеш, cookies или site data, весь локальный прогресс будет удалён."
            })}
          </p>
        </div>
      ) : null}

      {isLoading ? <p className="muted">{t({ en: "Loading sessions...", ru: "Загрузка тренировок..." })}</p> : null}

      {!isLoading && items.length === 0 ? (
        <section className="empty-state">
          <p>{t({ en: "No sessions yet.", ru: "Тренировок пока нет." })}</p>
        </section>
      ) : null}

      <section className="list">
        {items.map((item) => (
          <article className="session-row" key={item.key}>
            <div className="session-row-main">
              <strong>{item.templateName}</strong>
              <span>{formatDateTime(item.date, language)}</span>
            </div>
            <div className="session-stats">
              <span>{item.templateLevel ? `L${item.templateLevel}` : t({ en: "Level -", ru: "Уровень -" })}</span>
              <span>{formatTime(item.totalDurationSec)}</span>
              <span>{t({ en: "Run", ru: "Бег" })} {formatTime(item.totalRunSec)}</span>
              <span>D{item.difficulty}</span>
              <span>Max {item.maxHr ?? "-"}</span>
              <span>{item.pain}</span>
            </div>
            <span className={`sync-pill ${item.syncStatus}`}>{syncStatusLabel(item.syncStatus, language)}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
