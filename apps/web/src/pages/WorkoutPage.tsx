import {
  buildWorkoutTimeline,
  formatTime,
  getWorkoutStateAtElapsedMs,
  getWorkoutTotalsAtElapsedMs,
  type WorkoutPhase
} from "@run-walk-coach/shared";
import { CheckCircle2, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { localizeTemplateName, phaseLabel, useLanguage } from "../utils/language.js";
import { triggerPhaseChangeFeedback } from "../utils/phase-feedback.js";
import { useAppStore } from "../store/app-store.js";

function runControlFeedback() {
  navigator.vibrate?.(55);
}

export function WorkoutPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const activeWorkoutTemplate = useAppStore((state) => state.activeWorkoutTemplate);
  const templates = useAppStore((state) => state.templates);
  const recommendation = useAppStore((state) => state.recommendation);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const { language, t } = useLanguage();
  const recommendedTemplate = recommendation?.template;

  const template =
    activeWorkoutTemplate?.id === templateId
      ? activeWorkoutTemplate
      : templates.find((item) => item.id === templateId) ??
        (recommendedTemplate?.id === templateId ? recommendedTemplate : undefined);

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedDurationMs, setPausedDurationMs] = useState(0);
  const [transitionPhase, setTransitionPhase] = useState<WorkoutPhase | null>(null);

  useEffect(() => {
    if (!template && templateId) {
      void loadInitialData();
    }
  }, [loadInitialData, template, templateId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const timeline = useMemo(() => (template ? buildWorkoutTimeline(template) : undefined), [template]);
  const elapsedMs = Math.max(
    0,
    (pausedAt ?? now) - startedAt - pausedDurationMs
  );
  const state = timeline
    ? getWorkoutStateAtElapsedMs(timeline, elapsedMs)
    : undefined;
  const phaseKey = state ? `${state.phase}-${state.repeatIndex ?? 0}` : "none";
  const lastPhaseKey = useRef(phaseKey);

  useEffect(() => {
    if (state && lastPhaseKey.current !== phaseKey) {
      lastPhaseKey.current = phaseKey;
      setTransitionPhase(state.phase);
      triggerPhaseChangeFeedback(state.phase);
    }
  }, [phaseKey, state]);

  useEffect(() => {
    if (!transitionPhase) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setTransitionPhase(null), 950);
    return () => window.clearTimeout(timeout);
  }, [transitionPhase]);

  if (!template || !timeline || !state) {
    return (
      <main className="workout-screen phase-warmup">
        <div className="workout-loading">{t({ en: "Loading...", ru: "Загрузка..." })}</div>
      </main>
    );
  }

  const isPaused = pausedAt !== null;
  const progress = timeline.totalDurationSec
    ? Math.min(1, state.elapsedSec / timeline.totalDurationSec)
    : 0;

  const togglePause = () => {
    if (isPaused && pausedAt !== null) {
      setPausedDurationMs((value) => value + Date.now() - pausedAt);
      setPausedAt(null);
      runControlFeedback();
      return;
    }

    setPausedAt(Date.now());
    runControlFeedback();
  };

  const finishWorkout = () => {
    const effectiveElapsedMs = state.isDone ? timeline.totalDurationSec * 1000 : elapsedMs;
    const totals = state.isDone
      ? {
          totalDurationSec: timeline.totalDurationSec,
          totalRunSec: timeline.totalRunSec,
          totalWalkSec: timeline.totalWalkSec
        }
      : getWorkoutTotalsAtElapsedMs(timeline, effectiveElapsedMs);

    setWorkoutDraft({
      template,
      date: new Date().toISOString(),
      completed: state.isDone,
      elapsedMs: effectiveElapsedMs,
      ...totals
    });
    navigate("/session-report");
  };

  return (
    <main className={`workout-screen phase-${state.phase.toLowerCase()}`}>
      {transitionPhase ? (
        <div className="phase-transition" key={phaseKey} aria-hidden="true">
          <span>{phaseLabel(transitionPhase, language)}</span>
        </div>
      ) : null}

      <div className="workout-topline">
        <span>{localizeTemplateName(template.name, language)}</span>
        <span>{formatTime(state.elapsedSec)}</span>
      </div>

      <section className="timer-stage" key={phaseKey} aria-live="polite">
        <div className="phase-name">{phaseLabel(state.phase, language)}</div>
        <div className="timer-value">{formatTime(state.remainingSec)}</div>
        <div className="repeat-line">
          {state.repeatIndex
            ? `${t({ en: "Repeat", ru: "Повтор" })} ${state.repeatIndex} / ${state.totalRepeats}`
            : t({ en: "Steady start", ru: "Спокойный старт" })}
        </div>
      </section>

      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <section className="timer-meta">
        <div>
          <span>{t({ en: "Next", ru: "Дальше" })}</span>
          <strong>{phaseLabel(state.nextPhase, language)}</strong>
        </div>
        <div>
          <span>{t({ en: "Total", ru: "Всего" })}</span>
          <strong>{formatTime(timeline.totalDurationSec)}</strong>
        </div>
      </section>

      <div className="workout-controls">
        <button
          className="control-button"
          type="button"
          onClick={togglePause}
          title={isPaused ? t({ en: "Resume", ru: "Продолжить" }) : t({ en: "Pause", ru: "Пауза" })}
        >
          {isPaused ? <Play aria-hidden="true" size={30} fill="currentColor" /> : <Pause aria-hidden="true" size={30} />}
          <span>{isPaused ? t({ en: "Resume", ru: "Продолжить" }) : t({ en: "Pause", ru: "Пауза" })}</span>
        </button>
        <button
          className="control-button finish"
          type="button"
          onClick={finishWorkout}
          title={t({ en: "Finish workout", ru: "Завершить тренировку" })}
        >
          {state.isDone ? <CheckCircle2 aria-hidden="true" size={30} /> : <Square aria-hidden="true" size={28} fill="currentColor" />}
          <span>{state.isDone ? t({ en: "Report", ru: "Отчёт" }) : t({ en: "Finish", ru: "Финиш" })}</span>
        </button>
      </div>
    </main>
  );
}
