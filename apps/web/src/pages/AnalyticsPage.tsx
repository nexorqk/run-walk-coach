import { formatTime, type AnalyticsSummary } from "@run-walk-coach/shared";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { getAnalyticsSummary } from "../api/client.js";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { db } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";
import { localizeProgressionReason, localizeTemplateName, useLanguage } from "../utils/language.js";

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
  const { language, t } = useLanguage();
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
  }, [serverSyncEnabled, language]);

  return (
    <div className="stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">{t({ en: "Analytics", ru: "Аналитика" })}</div>
          <h1>{t({ en: "This week", ru: "Эта неделя" })}</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          title={t({ en: "Refresh analytics", ru: "Обновить аналитику" })}
        >
          <RefreshCcw aria-hidden="true" size={24} />
        </button>
      </section>

      {!serverSyncEnabled ? (
        <div className="warning-callout">
          <AlertTriangle aria-hidden="true" size={22} />
          <p>
            {t({
              en: "Without Google login, stats are saved only in this browser. If browser storage, cache, cookies, or site data are cleared, all local progress will be deleted.",
              ru: "Без входа через Google статистика хранится только в этом браузере. Если очистить память браузера, кеш, cookies или site data, весь локальный прогресс будет удалён."
            })}
          </p>
        </div>
      ) : null}

      {isLoading ? <p className="muted">{t({ en: "Loading analytics...", ru: "Загрузка аналитики..." })}</p> : null}

      {summary ? (
        <>
          <section className="summary-grid">
            <div className="metric">
              <span className="metric-label">{t({ en: "Sessions", ru: "Тренировки" })}</span>
              <strong>{summary.sessionsThisWeek}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">{t({ en: "Duration", ru: "Длительность" })}</span>
              <strong>{formatTime(summary.totalDurationThisWeekSec)}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">{t({ en: "Run time", ru: "Время бега" })}</span>
              <strong>{formatTime(summary.totalRunThisWeekSec)}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">{t({ en: "Avg difficulty", ru: "Средняя сложность" })}</span>
              <strong>{summary.averageDifficulty?.toFixed(1) ?? "-"}</strong>
            </div>
            <div className="metric metric-wide">
              <span className="metric-label">{t({ en: "Current level", ru: "Текущий уровень" })}</span>
              <strong>{summary.currentLevel}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">{t({ en: "Next", ru: "Дальше" })}</div>
            <h2>{localizeTemplateName(summary.next.template.name, language)}</h2>
            <p className="muted">{localizeProgressionReason(summary.next.reason, language)}</p>
          </section>

          <WorkoutSummary template={summary.next.template} />
        </>
      ) : !isLoading ? (
        <section className="empty-state">
          <p>{t({ en: "No analytics available.", ru: "Аналитика пока недоступна." })}</p>
        </section>
      ) : null}
    </div>
  );
}
