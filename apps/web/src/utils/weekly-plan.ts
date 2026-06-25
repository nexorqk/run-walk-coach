import type { PainType } from "@run-walk-coach/shared";

export type WeeklyRunTarget = 2 | 3;
export type WeeklyActivityType = "run" | "strength" | "cross" | "rest";
export type WeeklyPlanWarningType = "load-spike" | "too-many-runs" | "consecutive-runs" | "hard-latest";

export type WeeklyPlanSession = {
  date: string;
  completed: boolean;
  totalDurationSec: number;
  totalRunSec: number;
  difficulty: number;
  pain?: PainType;
  maxHr?: number | null;
};

export type WeeklyPlanDay = {
  id: string;
  dateKey: string;
  dayIndex: number;
  type: WeeklyActivityType;
  isToday: boolean;
  runSessionCount: number;
  completedRunSec: number;
};

export type WeeklyPlanWarning = {
  type: WeeklyPlanWarningType;
  severity: "caution" | "danger";
};

export type WeeklyPlan = {
  weekKey: string;
  weekStartKey: string;
  weekEndKey: string;
  runTarget: WeeklyRunTarget;
  days: WeeklyPlanDay[];
  stats: {
    completedRunsThisWeek: number;
    currentWeekDurationSec: number;
    currentWeekRunSec: number;
    previousWeekDurationSec: number;
    previousWeekRunSec: number;
    loadRatio: number | null;
  };
  warnings: WeeklyPlanWarning[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function activityForDay(dayIndex: number, runTarget: WeeklyRunTarget): WeeklyActivityType {
  if (runTarget === 3) {
    const schedule: WeeklyActivityType[] = ["strength", "run", "cross", "run", "strength", "run", "rest"];
    return schedule[dayIndex] ?? "rest";
  }

  const schedule: WeeklyActivityType[] = ["strength", "run", "cross", "strength", "run", "cross", "rest"];
  return schedule[dayIndex] ?? "rest";
}

function isRunSession(session: WeeklyPlanSession) {
  return session.completed && session.totalRunSec > 0;
}

function between(date: Date, from: Date, to: Date) {
  return date >= from && date < to;
}

function uniqueRunDateKeys(sessions: WeeklyPlanSession[]) {
  return [...new Set(sessions.filter(isRunSession).map((session) => dateKey(new Date(session.date))))].sort();
}

function hasConsecutiveDates(dateKeys: string[]) {
  for (let index = 1; index < dateKeys.length; index += 1) {
    const previous = new Date(`${dateKeys[index - 1]}T00:00:00`);
    const current = new Date(`${dateKeys[index]}T00:00:00`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);

    if (diffDays === 1) {
      return true;
    }
  }

  return false;
}

export function recommendedRunTarget(level: number | undefined, sessions: WeeklyPlanSession[]): WeeklyRunTarget {
  const recentRuns = uniqueRunDateKeys(sessions)
    .filter((key) => new Date(`${key}T00:00:00`) >= addDays(startOfWeek(new Date()), -21))
    .length;

  if ((level ?? 1) >= 5 && recentRuns >= 4) {
    return 3;
  }

  return 2;
}

export function buildWeeklyPlan({
  now = new Date(),
  runTarget,
  sessions
}: {
  now?: Date;
  runTarget: WeeklyRunTarget;
  sessions: WeeklyPlanSession[];
}): WeeklyPlan {
  const weekStart = startOfWeek(now);
  const nextWeekStart = addDays(weekStart, 7);
  const previousWeekStart = addDays(weekStart, -7);
  const todayKey = dateKey(now);
  const weekSessions = sessions.filter((session) => between(new Date(session.date), weekStart, nextWeekStart));
  const previousWeekSessions = sessions.filter((session) => between(new Date(session.date), previousWeekStart, weekStart));
  const runDateKeysThisWeek = uniqueRunDateKeys(weekSessions);
  const currentWeekDurationSec = weekSessions.reduce((sum, session) => sum + session.totalDurationSec, 0);
  const currentWeekRunSec = weekSessions.reduce((sum, session) => sum + session.totalRunSec, 0);
  const previousWeekDurationSec = previousWeekSessions.reduce((sum, session) => sum + session.totalDurationSec, 0);
  const previousWeekRunSec = previousWeekSessions.reduce((sum, session) => sum + session.totalRunSec, 0);
  const loadRatio = previousWeekDurationSec > 0 ? currentWeekDurationSec / previousWeekDurationSec : null;
  const latestSession = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const warnings: WeeklyPlanWarning[] = [];

  if (loadRatio !== null && loadRatio > 1.3) {
    warnings.push({ type: "load-spike", severity: loadRatio > 1.55 ? "danger" : "caution" });
  }

  if (runDateKeysThisWeek.length > runTarget) {
    warnings.push({ type: "too-many-runs", severity: "caution" });
  }

  if (hasConsecutiveDates(runDateKeysThisWeek)) {
    warnings.push({ type: "consecutive-runs", severity: "caution" });
  }

  if (
    latestSession &&
    (latestSession.difficulty >= 8 ||
      (latestSession.pain !== undefined && latestSession.pain !== "NONE") ||
      (latestSession.maxHr !== null && latestSession.maxHr !== undefined && latestSession.maxHr >= 170))
  ) {
    warnings.push({ type: "hard-latest", severity: "caution" });
  }

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const day = addDays(weekStart, dayIndex);
    const key = dateKey(day);
    const daySessions = weekSessions.filter((session) => dateKey(new Date(session.date)) === key);

    return {
      id: `${dateKey(weekStart)}-${dayIndex}`,
      dateKey: key,
      dayIndex,
      type: activityForDay(dayIndex, runTarget),
      isToday: key === todayKey,
      runSessionCount: daySessions.filter(isRunSession).length,
      completedRunSec: daySessions.reduce((sum, session) => sum + session.totalRunSec, 0)
    };
  });

  return {
    weekKey: dateKey(weekStart),
    weekStartKey: dateKey(weekStart),
    weekEndKey: dateKey(addDays(weekStart, 6)),
    runTarget,
    days,
    stats: {
      completedRunsThisWeek: runDateKeysThisWeek.length,
      currentWeekDurationSec,
      currentWeekRunSec,
      previousWeekDurationSec,
      previousWeekRunSec,
      loadRatio
    },
    warnings
  };
}
