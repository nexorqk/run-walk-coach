import { formatTime, type AnalyticsSummary } from "@run-walk-coach/shared";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getAnalyticsSummary } from "../api/client.js";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { db } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

export function AnalyticsPage() {
  const recommendation = useAppStore((state) => state.recommendation);
  const refreshRecommendation = useAppStore((state) => state.refreshRecommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocal = async () => {
      const weekStart = startOfWeek(new Date());
      const localSessions = await db.sessions.toArray();
      const weekSessions = localSessions.filter((session) => new Date(session.date) >= weekStart);
      const averageDifficulty =
        weekSessions.length === 0
          ? null
          : weekSessions.reduce((sum, session) => sum + session.difficulty, 0) / weekSessions.length;
      const latest = [...localSessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      if (recommendation) {
        setSummary({
          sessionsThisWeek: weekSessions.length,
          totalDurationThisWeekSec: weekSessions.reduce(
            (sum, session) => sum + session.totalDurationSec,
            0
          ),
          totalRunThisWeekSec: weekSessions.reduce((sum, session) => sum + session.totalRunSec, 0),
          averageDifficulty,
          currentLevel: latest?.templateLevel ?? recommendation.template.level,
          next: recommendation
        });
      }
  };

  const load = async () => {
    setIsLoading(true);

    try {
      if (serverSyncEnabled) {
        setSummary(await getAnalyticsSummary());
      } else {
        await loadLocal();
      }
    } catch {
      await loadLocal();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshRecommendation().finally(load);
  }, [serverSyncEnabled]);

  return (
    <div className="stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">Analytics</div>
          <h1>This week</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => void load()} title="Refresh analytics">
          <RefreshCcw aria-hidden="true" size={24} />
        </button>
      </section>

      {!serverSyncEnabled ? (
        <div className="warning-callout">
          <AlertTriangle aria-hidden="true" size={22} />
          <p>
            Без входа через Google статистика хранится только в этом браузере. Если очистить
            память браузера, кеш, cookies или site data, весь локальный прогресс будет удалён.
          </p>
        </div>
      ) : null}

      {isLoading ? <p className="muted">Loading analytics...</p> : null}

      {summary ? (
        <>
          <section className="summary-grid">
            <div className="metric">
              <span className="metric-label">Sessions</span>
              <strong>{summary.sessionsThisWeek}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">Duration</span>
              <strong>{formatTime(summary.totalDurationThisWeekSec)}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">Run time</span>
              <strong>{formatTime(summary.totalRunThisWeekSec)}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">Avg difficulty</span>
              <strong>{summary.averageDifficulty?.toFixed(1) ?? "-"}</strong>
            </div>
            <div className="metric metric-wide">
              <span className="metric-label">Current level</span>
              <strong>{summary.currentLevel}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Next</div>
            <h2>{summary.next.template.name}</h2>
            <p className="muted">{summary.next.reason}</p>
          </section>

          <WorkoutSummary template={summary.next.template} />
        </>
      ) : !isLoading ? (
        <section className="empty-state">
          <p>No analytics available.</p>
        </section>
      ) : null}
    </div>
  );
}
