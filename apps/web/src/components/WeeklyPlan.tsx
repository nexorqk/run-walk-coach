import { formatTime, type ProgressionResponse, type WorkoutSession } from "@run-walk-coach/shared";
import {
  AlertTriangle,
  Bed,
  Bike,
  CalendarDays,
  CheckCircle2,
  Circle,
  Dumbbell,
  Footprints,
  Play,
  RefreshCcw
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/client.js";
import { db, type LocalWorkoutSession } from "../db/local-db.js";
import { localizeTemplateName, text, type AppLanguage, useLanguage } from "../utils/language.js";
import { WEEKLY_PLAN_COMPLETION_KEY, WEEKLY_RUN_TARGET_KEY } from "../utils/storage-keys.js";
import {
  buildWeeklyPlan,
  dateKey,
  recommendedRunTarget,
  type WeeklyActivityType,
  type WeeklyPlanDay,
  type WeeklyPlanSession,
  type WeeklyPlanWarning,
  type WeeklyRunTarget
} from "../utils/weekly-plan.js";

type WeeklyPlanProps = {
  recommendation?: ProgressionResponse;
  serverSyncEnabled: boolean;
  onStartWorkout: () => void;
};

type CompletionMap = Record<string, true>;

function localToPlanSession(session: LocalWorkoutSession): WeeklyPlanSession {
  return {
    date: session.date,
    completed: session.completed,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    pain: session.pain,
    maxHr: session.maxHr
  };
}

function remoteToPlanSession(session: WorkoutSession): WeeklyPlanSession {
  return {
    date: session.date,
    completed: session.completed,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    pain: session.pain,
    maxHr: session.maxHr
  };
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function readRunTarget(): WeeklyRunTarget | undefined {
  try {
    const value = localStorage.getItem(WEEKLY_RUN_TARGET_KEY);
    return value === "2" || value === "3" ? (Number(value) as WeeklyRunTarget) : undefined;
  } catch {
    return undefined;
  }
}

function saveRunTarget(runTarget: WeeklyRunTarget) {
  try {
    localStorage.setItem(WEEKLY_RUN_TARGET_KEY, String(runTarget));
  } catch {
    // The plan can still update for the current tab if persistence is blocked.
  }
}

function saveCompletionMap(completionMap: CompletionMap) {
  try {
    localStorage.setItem(WEEKLY_PLAN_COMPLETION_KEY, JSON.stringify(completionMap));
  } catch {
    // Completion marks are optional browser-only state.
  }
}

function completionKey(day: WeeklyPlanDay) {
  return `${day.id}:${day.type}`;
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

function dayLabel(day: WeeklyPlanDay, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : undefined, {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(dateFromKey(day.dateKey));
}

function activityLabel(type: WeeklyActivityType, language: AppLanguage) {
  const labels: Record<WeeklyActivityType, Record<AppLanguage, string>> = {
    run: { en: "Run-walk", ru: "Бег-шаг" },
    strength: { en: "Strength", ru: "Силовая" },
    cross: { en: "Walk / bike", ru: "Ходьба / велосипед" },
    rest: { en: "Rest", ru: "Отдых" }
  };

  return text(language, labels[type]);
}

function activityDescription(
  day: WeeklyPlanDay,
  language: AppLanguage,
  recommendation?: ProgressionResponse
) {
  if (day.type === "run") {
    return recommendation?.template
      ? localizeTemplateName(recommendation.template.name, language)
      : text(language, { en: "Easy controlled run-walk", ru: "Лёгкий контролируемый бег-шаг" });
  }

  const descriptions: Record<Exclude<WeeklyActivityType, "run">, Record<AppLanguage, string>> = {
    strength: {
      en: "20-40 min. Keep legs fresh before run days.",
      ru: "20-40 мин. Не убивай ноги перед беговыми днями."
    },
    cross: {
      en: "Easy walk or bike. Keep breathing calm.",
      ru: "Лёгкая ходьба или велосипед. Дыхание спокойное."
    },
    rest: {
      en: "No running. Mobility or a calm walk is enough.",
      ru: "Без бега. Достаточно мобильности или спокойной прогулки."
    }
  };

  return text(language, descriptions[day.type]);
}

function warningText(warning: WeeklyPlanWarning, language: AppLanguage) {
  const copy: Record<WeeklyPlanWarning["type"], Record<AppLanguage, string>> = {
    "load-spike": {
      en: "Training load is growing faster than 30% versus last week. Keep the next run very easy or replace it with walking.",
      ru: "Нагрузка растёт быстрее 30% к прошлой неделе. Следующий бег сделай очень лёгким или замени ходьбой."
    },
    "too-many-runs": {
      en: "You already have more run days than planned this week. Add rest or easy cross-training.",
      ru: "На этой неделе уже больше беговых дней, чем в плане. Добавь отдых или лёгкую альтернативу."
    },
    "consecutive-runs": {
      en: "Consecutive run days increase shin, knee, and Achilles risk. Put rest or walking between runs.",
      ru: "Беговые дни подряд повышают риск для голени, коленей и ахилла. Ставь отдых или ходьбу между бегом."
    },
    "hard-latest": {
      en: "The latest session looked hard. Do not increase volume until breathing, HR, and pain are under control.",
      ru: "Последняя тренировка выглядела тяжёлой. Не увеличивай объём, пока дыхание, пульс и боль не под контролем."
    }
  };

  return text(language, copy[warning.type]);
}

function ActivityIcon({ type }: { type: WeeklyActivityType }) {
  if (type === "run") return <Footprints aria-hidden="true" size={22} />;
  if (type === "strength") return <Dumbbell aria-hidden="true" size={22} />;
  if (type === "cross") return <Bike aria-hidden="true" size={22} />;
  return <Bed aria-hidden="true" size={22} />;
}

export function WeeklyPlan({ recommendation, serverSyncEnabled, onStartWorkout }: WeeklyPlanProps) {
  const { language, t } = useLanguage();
  const [sessions, setSessions] = useState<WeeklyPlanSession[]>([]);
  const [completionMap, setCompletionMap] = useState<CompletionMap>(() => readJson<CompletionMap>(WEEKLY_PLAN_COMPLETION_KEY) ?? {});
  const [storedRunTarget, setStoredRunTarget] = useState<WeeklyRunTarget | undefined>(() => readRunTarget());
  const [isLoading, setIsLoading] = useState(true);
  const suggestedRunTarget = useMemo(
    () => recommendedRunTarget(recommendation?.template.level, sessions),
    [recommendation?.template.level, sessions]
  );
  const runTarget = storedRunTarget ?? suggestedRunTarget;
  const plan = useMemo(
    () => buildWeeklyPlan({ runTarget, sessions }),
    [runTarget, sessions]
  );

  useEffect(() => {
    let ignore = false;

    async function loadSessions() {
      setIsLoading(true);

      try {
        if (serverSyncEnabled) {
          const remoteSessions = await getSessions();
          if (!ignore) {
            setSessions(remoteSessions.map(remoteToPlanSession));
          }
          return;
        }

        const localSessions = await db.sessions.toArray();
        if (!ignore) {
          setSessions(localSessions.map(localToPlanSession));
        }
      } catch {
        const localSessions = await db.sessions.toArray();
        if (!ignore) {
          setSessions(localSessions.map(localToPlanSession));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      ignore = true;
    };
  }, [serverSyncEnabled]);

  const changeRunTarget = (nextRunTarget: WeeklyRunTarget) => {
    setStoredRunTarget(nextRunTarget);
    saveRunTarget(nextRunTarget);
  };

  const toggleDone = (day: WeeklyPlanDay) => {
    const key = completionKey(day);
    const nextCompletionMap = { ...completionMap };

    if (nextCompletionMap[key]) {
      delete nextCompletionMap[key];
    } else {
      nextCompletionMap[key] = true;
    }

    setCompletionMap(nextCompletionMap);
    saveCompletionMap(nextCompletionMap);
  };

  return (
    <section className="panel weekly-plan">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t({ en: "Week plan", ru: "План недели" })}</div>
          <h2>{t({ en: "Build the week, not just today", ru: "Планируй неделю, не только сегодня" })}</h2>
        </div>
        <p className="muted">
          {t({
            en: "Run 2-3 times, keep rest days between runs, and use strength or easy bike/walking for support.",
            ru: "Бегай 2-3 раза, оставляй восстановление между беговыми днями и добавляй силовые или лёгкий велосипед/ходьбу."
          })}
        </p>
      </div>

      <div className="weekly-plan-toolbar">
        <div className="segmented-control" role="group" aria-label={t({ en: "Run days per week", ru: "Беговых дней в неделю" })}>
          <button
            className={`segment-option ${runTarget === 2 ? "active" : ""}`}
            type="button"
            aria-pressed={runTarget === 2}
            onClick={() => changeRunTarget(2)}
          >
            <CalendarDays aria-hidden="true" size={20} />
            {t({ en: "2 runs", ru: "2 бега" })}
          </button>
          <button
            className={`segment-option ${runTarget === 3 ? "active" : ""}`}
            type="button"
            aria-pressed={runTarget === 3}
            onClick={() => changeRunTarget(3)}
          >
            <CalendarDays aria-hidden="true" size={20} />
            {t({ en: "3 runs", ru: "3 бега" })}
          </button>
        </div>

        <div className="weekly-plan-stats">
          <span>{t({ en: "Runs", ru: "Бег" })}: {plan.stats.completedRunsThisWeek}/{plan.runTarget}</span>
          <span>{t({ en: "Run time", ru: "Время бега" })}: {formatTime(plan.stats.currentWeekRunSec)}</span>
          <span>
            {t({ en: "Load", ru: "Нагрузка" })}:{" "}
            {plan.stats.loadRatio === null ? "-" : `${Math.round((plan.stats.loadRatio - 1) * 100)}%`}
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="muted">{t({ en: "Loading weekly plan...", ru: "Загрузка недельного плана..." })}</p>
      ) : null}

      {plan.warnings.length > 0 ? (
        <div className="weekly-warning-list">
          {plan.warnings.map((warning) => (
            <div
              className={warning.severity === "danger" ? "warning-callout weekly-warning danger" : "warning-callout weekly-warning"}
              key={warning.type}
            >
              <AlertTriangle aria-hidden="true" size={22} />
              <p>{warningText(warning, language)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="weekly-plan-grid">
        {plan.days.map((day) => {
          const isRunDone = day.runSessionCount > 0;
          const isManualDone = completionMap[completionKey(day)] === true;
          const isDone = day.type === "run" ? isRunDone : isManualDone;
          const canMarkDone = day.type !== "run";

          return (
            <article
              className={`weekly-day ${day.isToday ? "today" : ""} ${isDone ? "done" : ""}`}
              key={day.id}
            >
              <div className="weekly-day-top">
                <ActivityIcon type={day.type} />
                <span>{dayLabel(day, language)}</span>
                {isDone ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
              </div>
              <h3>{activityLabel(day.type, language)}</h3>
              <p>{activityDescription(day, language, recommendation)}</p>
              {day.type === "run" && isRunDone ? (
                <span className="weekly-day-meta">
                  {t({ en: "Done", ru: "Выполнено" })}: {formatTime(day.completedRunSec)}
                </span>
              ) : null}
              {day.type === "run" && day.isToday && !isRunDone ? (
                <button className="secondary-action compact-action" type="button" onClick={onStartWorkout}>
                  <Play aria-hidden="true" size={20} fill="currentColor" />
                  {t({ en: "Start", ru: "Начать" })}
                </button>
              ) : null}
              {canMarkDone ? (
                <button className="secondary-action compact-action" type="button" onClick={() => toggleDone(day)}>
                  {isManualDone ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
                  {isManualDone ? t({ en: "Done", ru: "Готово" }) : t({ en: "Mark done", ru: "Отметить" })}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="muted">
        <RefreshCcw aria-hidden="true" size={16} className="inline-icon" />
        {t({
          en: "Run days are completed from workout history. Strength, walking, bike, and rest can be marked manually in this browser.",
          ru: "Беговые дни закрываются из истории тренировок. Силовые, ходьба, велосипед и отдых отмечаются вручную в этом браузере."
        })}
      </p>
    </section>
  );
}
