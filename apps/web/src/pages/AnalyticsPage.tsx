import { formatTime, type AnalyticsSummary, type WorkoutSession } from "@run-walk-coach/shared";
import { Activity, AlertTriangle, HeartPulse, Percent, RefreshCcw, Sparkles, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAnalyticsSummary, getSessions } from "../api/client.js";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { db, type LocalWorkoutSession } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";
import {
  formatDateTime,
  localizeProgressionReason,
  localizeTemplateName,
  useLanguage
} from "../utils/language.js";
import {
  formatCadenceSpm,
  formatDistanceMeters,
  formatPaceSecPerKm,
  formatSpeedKmh
} from "../utils/running-metrics.js";

type TrendSession = {
  key: string;
  date: string;
  totalDurationSec: number;
  totalRunSec: number;
  difficulty: number;
  avgHr?: number | null;
  maxHr?: number | null;
  distanceMeters?: number | null;
  avgPaceSecPerKm?: number | null;
  avgSpeedKmh?: number | null;
  cadenceSpm?: number | null;
  templateLevel?: number;
};

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function localToTrend(session: LocalWorkoutSession): TrendSession {
  return {
    key: session.localId,
    date: session.date,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    templateLevel: session.templateLevel
  };
}

function remoteToTrend(session: WorkoutSession): TrendSession {
  return {
    key: session.id,
    date: session.date,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    templateLevel: session.template?.level
  };
}

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null) {
    return "-";
  }

  if (Math.abs(value) < 0.05) {
    return `0${suffix}`;
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

function formatTimeDelta(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value === 0) {
    return "0:00";
  }

  return `${value > 0 ? "+" : "-"}${formatTime(Math.abs(value))}`;
}

function formatDistanceDelta(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value === 0) {
    return "0.00 km";
  }

  return `${value > 0 ? "+" : "-"}${formatDistanceMeters(Math.abs(value))}`;
}

function buildLocalSummary(
  sessions: TrendSession[],
  recommendation: AnalyticsSummary["next"] | undefined
): AnalyticsSummary | null {
  if (!recommendation) {
    return null;
  }

  const weekStart = startOfWeek(new Date());
  const weekSessions = sessions.filter((session) => new Date(session.date) >= weekStart);
  const latest = sessions[0];

  return {
    sessionsThisWeek: weekSessions.length,
    totalDurationThisWeekSec: weekSessions.reduce((sum, session) => sum + session.totalDurationSec, 0),
    totalRunThisWeekSec: weekSessions.reduce((sum, session) => sum + session.totalRunSec, 0),
    averageDifficulty: average(weekSessions.map((session) => session.difficulty)),
    currentLevel: latest?.templateLevel ?? recommendation.template.level,
    next: recommendation
  };
}

export function AnalyticsPage() {
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const refreshRecommendation = useAppStore((state) => state.refreshRecommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sessions, setSessions] = useState<TrendSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocal = useCallback(async () => {
    const localSessions = (await db.sessions.orderBy("date").reverse().toArray()).map(localToTrend);
    setSessions(localSessions);
    setSummary(buildLocalSummary(localSessions, useAppStore.getState().recommendation));
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      if (serverSyncEnabled) {
        const [remoteSummary, remoteSessions] = await Promise.all([
          getAnalyticsSummary(),
          getSessions()
        ]);

        setSummary(remoteSummary);
        setSessions(remoteSessions.map(remoteToTrend));
      } else {
        await loadLocal();
      }
    } catch {
      await loadLocal();
    } finally {
      setIsLoading(false);
    }
  }, [loadLocal, serverSyncEnabled]);

  useEffect(() => {
    let ignore = false;

    void refreshRecommendation()
      .then(() => {
        if (!ignore) {
          return load();
        }

        return undefined;
      })
      .catch(() => {
        if (!ignore) {
          return load();
        }

        return undefined;
      });

    return () => {
      ignore = true;
    };
  }, [language, load, refreshRecommendation]);

  const trends = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestSix = sorted.slice(0, 6);
    const previousSix = sorted.slice(6, 12);
    const lastThree = sorted.slice(0, 3);
    const previousThree = sorted.slice(3, 6);
    const weekStart = startOfWeek(new Date());
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const weekSessions = sorted.filter((session) => new Date(session.date) >= weekStart);
    const previousWeekSessions = sorted.filter((session) => {
      const date = new Date(session.date);
      return date >= previousWeekStart && date < weekStart;
    });
    const runRatio =
      weekSessions.length === 0
        ? null
        : weekSessions.reduce((sum, session) => sum + session.totalRunSec, 0) /
          Math.max(1, weekSessions.reduce((sum, session) => sum + session.totalDurationSec, 0));
    const weekRunSec = weekSessions.reduce((sum, session) => sum + session.totalRunSec, 0);
    const previousWeekRunSec = previousWeekSessions.reduce((sum, session) => sum + session.totalRunSec, 0);
    const weekDistanceMeters = weekSessions.reduce((sum, session) => sum + (session.distanceMeters ?? 0), 0);
    const previousWeekDistanceMeters = previousWeekSessions.reduce((sum, session) => sum + (session.distanceMeters ?? 0), 0);
    const avgLastThreeDifficulty = average(lastThree.map((session) => session.difficulty));
    const avgPreviousThreeDifficulty = average(previousThree.map((session) => session.difficulty));
    const avgDifficultyDelta =
      avgLastThreeDifficulty !== null && avgPreviousThreeDifficulty !== null
        ? avgLastThreeDifficulty - avgPreviousThreeDifficulty
        : null;
    const avgMaxHr = average(latestSix.map((session) => session.maxHr).filter((value): value is number => value !== null && value !== undefined));
    const previousAvgMaxHr = average(previousSix.map((session) => session.maxHr).filter((value): value is number => value !== null && value !== undefined));
    const avgPaceSecPerKm = average(latestSix.map((session) => session.avgPaceSecPerKm).filter((value): value is number => value !== null && value !== undefined));
    const avgSpeedKmh = average(latestSix.map((session) => session.avgSpeedKmh).filter((value): value is number => value !== null && value !== undefined));
    const avgCadenceSpm = average(latestSix.map((session) => session.cadenceSpm).filter((value): value is number => value !== null && value !== undefined));

    return {
      recent: latestSix,
      runRatio,
      weekRunSec,
      weekRunDeltaSec: previousWeekSessions.length === 0 ? null : weekRunSec - previousWeekRunSec,
      weekDistanceMeters,
      weekDistanceDeltaMeters: previousWeekSessions.length === 0 ? null : weekDistanceMeters - previousWeekDistanceMeters,
      avgPaceSecPerKm,
      avgSpeedKmh,
      avgCadenceSpm,
      avgDifficultyDelta,
      avgMaxHr,
      avgMaxHrDelta: avgMaxHr !== null && previousAvgMaxHr !== null ? avgMaxHr - previousAvgMaxHr : null
    };
  }, [sessions]);

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

          <section className="trend-grid">
            <div className="trend-card">
              <TrendingUp aria-hidden="true" size={22} />
              <span>{t({ en: "Run volume", ru: "Объём бега" })}</span>
              <strong>{formatTime(trends.weekRunSec)}</strong>
              <p>{t({ en: "vs previous week", ru: "к прошлой неделе" })}: {formatTimeDelta(trends.weekRunDeltaSec)}</p>
            </div>
            <div className="trend-card">
              <Percent aria-hidden="true" size={22} />
              <span>{t({ en: "Run ratio", ru: "Доля бега" })}</span>
              <strong>{trends.runRatio === null ? "-" : `${Math.round(trends.runRatio * 100)}%`}</strong>
              <p>{t({ en: "of total workout time", ru: "от общего времени" })}</p>
            </div>
            <div className="trend-card">
              <TrendingUp aria-hidden="true" size={22} />
              <span>{t({ en: "Distance", ru: "Дистанция" })}</span>
              <strong>{formatDistanceMeters(trends.weekDistanceMeters)}</strong>
              <p>{t({ en: "vs previous week", ru: "к прошлой неделе" })}: {formatDistanceDelta(trends.weekDistanceDeltaMeters)}</p>
            </div>
            <div className="trend-card">
              <Activity aria-hidden="true" size={22} />
              <span>{t({ en: "Avg pace", ru: "Средний темп" })}</span>
              <strong>{formatPaceSecPerKm(trends.avgPaceSecPerKm)}</strong>
              <p>{t({ en: "latest saved pace values", ru: "по последним сохранённым темпам" })}</p>
            </div>
            <div className="trend-card">
              <Percent aria-hidden="true" size={22} />
              <span>{t({ en: "Avg speed", ru: "Средняя скорость" })}</span>
              <strong>{formatSpeedKmh(trends.avgSpeedKmh)}</strong>
              <p>{t({ en: "latest saved speed values", ru: "по последним сохранённым скоростям" })}</p>
            </div>
            <div className="trend-card">
              <Activity aria-hidden="true" size={22} />
              <span>{t({ en: "Cadence", ru: "Каденс" })}</span>
              <strong>{formatCadenceSpm(trends.avgCadenceSpm === null ? null : Math.round(trends.avgCadenceSpm))}</strong>
              <p>{t({ en: "steps per minute", ru: "шагов в минуту" })}</p>
            </div>
            <div className="trend-card">
              <Activity aria-hidden="true" size={22} />
              <span>{t({ en: "Difficulty trend", ru: "Тренд сложности" })}</span>
              <strong>{formatDelta(trends.avgDifficultyDelta)}</strong>
              <p>{t({ en: "last 3 vs previous 3", ru: "последние 3 к предыдущим 3" })}</p>
            </div>
            <div className="trend-card">
              <HeartPulse aria-hidden="true" size={22} />
              <span>{t({ en: "Avg max HR", ru: "Средний max пульс" })}</span>
              <strong>{trends.avgMaxHr === null ? "-" : Math.round(trends.avgMaxHr)}</strong>
              <p>
                {profile?.easyHrMax ? `${t({ en: "easy max", ru: "лёгкий max" })}: ${profile.easyHrMax}` : formatDelta(trends.avgMaxHrDelta, " bpm")}
              </p>
            </div>
          </section>

          {trends.recent.length > 0 ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">{t({ en: "Trend", ru: "Тренд" })}</div>
                  <h2>{t({ en: "Recent sessions", ru: "Последние тренировки" })}</h2>
                </div>
              </div>
              <div className="trend-list">
                {trends.recent.map((session) => (
                  <div className="trend-row" key={session.key}>
                    <span>{formatDateTime(session.date, language)}</span>
                    <strong>{session.templateLevel ? `L${session.templateLevel}` : "-"}</strong>
                    <span>{t({ en: "Run", ru: "Бег" })} {formatTime(session.totalRunSec)}</span>
                    {session.distanceMeters !== null && session.distanceMeters !== undefined ? (
                      <span>{formatDistanceMeters(session.distanceMeters)}</span>
                    ) : null}
                    {session.avgPaceSecPerKm !== null && session.avgPaceSecPerKm !== undefined ? (
                      <span>{formatPaceSecPerKm(session.avgPaceSecPerKm)}</span>
                    ) : null}
                    <span>D{session.difficulty}</span>
                    <span>Max {session.maxHr ?? "-"}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="eyebrow">{t({ en: "Next", ru: "Дальше" })}</div>
            <h2>{localizeTemplateName(summary.next.template.name, language)}</h2>
            <p className="muted">{localizeProgressionReason(summary.next.reason, language)}</p>
            {summary.next.adaptations && summary.next.adaptations.length > 0 ? (
              <div className="coach-callout">
                <Sparkles aria-hidden="true" size={20} />
                <p>
                  {summary.next.adaptations.map((a) => {
                    const sign = a.delta > 0 ? "+" : "";
                    const field = a.field === "runSec"
                      ? t({ en: "run", ru: "бег" })
                      : a.field === "walkSec"
                        ? t({ en: "walk", ru: "шаг" })
                        : t({ en: "repeats", ru: "повторы" });
                    const unit = a.field === "repeats" ? "" : "s";
                    return `${field} ${sign}${a.delta}${unit}`;
                  }).join(", ")}
                </p>
              </div>
            ) : null}
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
