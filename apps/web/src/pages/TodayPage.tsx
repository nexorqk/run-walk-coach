import { buildWorkoutTimeline, formatTime } from "@run-walk-coach/shared";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateWorkoutTemplate } from "../api/client.js";
import { ReadinessCheck } from "../components/ReadinessCheck.js";
import { showToast } from "../components/Toaster.js";
import { WeeklyPlan } from "../components/WeeklyPlan.js";
import { useAppStore } from "../store/app-store.js";
import {
  localizeProgressionReason,
  localizeTemplateName,
  progressionActionLabel,
  useLanguage
} from "../utils/language.js";
import { primePhaseAudio } from "../utils/phase-feedback.js";

const TIMING_DRAFT_KEY = "timingDraft";

type TimingDraft = {
  warmupSec: string;
  runSec: string;
  walkSec: string;
  cooldownSec: string;
};

function getStoredTimingDraft(): TimingDraft | undefined {
  try {
    const raw = localStorage.getItem(TIMING_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as TimingDraft) : undefined;
  } catch {
    return undefined;
  }
}

function saveTimingDraft(draft: TimingDraft) {
  localStorage.setItem(TIMING_DRAFT_KEY, JSON.stringify(draft));
}

function clearTimingDraft() {
  localStorage.removeItem(TIMING_DRAFT_KEY);
}

export function TodayPage() {
  const navigate = useNavigate();
  const recommendation = useAppStore((state) => state.recommendation);
  const isLoading = useAppStore((state) => state.isLoading);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const updateLocalWorkoutTemplate = useAppStore((state) => state.updateLocalWorkoutTemplate);
  const setActiveWorkoutTemplate = useAppStore((state) => state.setActiveWorkoutTemplate);
  const { language, t } = useLanguage();
  const template = recommendation?.template;

  const [warmupSec, setWarmupSec] = useState("600");
  const [runSec, setRunSec] = useState("30");
  const [walkSec, setWalkSec] = useState("90");
  const [cooldownSec, setCooldownSec] = useState("300");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!template) {
      return;
    }

    const stored = getStoredTimingDraft();

    if (stored) {
      setWarmupSec(stored.warmupSec);
      setRunSec(stored.runSec);
      setWalkSec(stored.walkSec);
      setCooldownSec(stored.cooldownSec);
    } else {
      setWarmupSec(String(template.warmupSec));
      setRunSec(String(template.runSec));
      setWalkSec(String(template.walkSec));
      setCooldownSec(String(template.cooldownSec));
    }
  }, [template]);

  useEffect(() => {
    if (!template) {
      return;
    }

    saveTimingDraft({ warmupSec, runSec, walkSec, cooldownSec });
  }, [warmupSec, runSec, walkSec, cooldownSec, template]);

  if (isLoading && !template) {
    return (
      <section className="empty-state">
        <div className="loader" />
        <p>{t({ en: "Loading workout...", ru: "Загрузка тренировки..." })}</p>
      </section>
    );
  }

  if (!template) {
    return (
      <section className="empty-state">
        <p>{t({ en: "No workout template is available.", ru: "Шаблон тренировки недоступен." })}</p>
      </section>
    );
  }

  const parsedWarmupSec = Number(warmupSec);
  const parsedRunSec = Number(runSec);
  const parsedWalkSec = Number(walkSec);
  const parsedCooldownSec = Number(cooldownSec);
  const hasValidTiming =
    warmupSec.trim() !== "" &&
    runSec.trim() !== "" &&
    walkSec.trim() !== "" &&
    cooldownSec.trim() !== "" &&
    Number.isFinite(parsedWarmupSec) &&
    Number.isFinite(parsedRunSec) &&
    Number.isFinite(parsedWalkSec) &&
    Number.isFinite(parsedCooldownSec);

  const editedTemplate = {
    ...template,
    warmupSec: hasValidTiming ? parsedWarmupSec : template.warmupSec,
    runSec: hasValidTiming ? parsedRunSec : template.runSec,
    walkSec: hasValidTiming ? parsedWalkSec : template.walkSec,
    cooldownSec: hasValidTiming ? parsedCooldownSec : template.cooldownSec
  };
  const totalDurationSec = hasValidTiming ? buildWorkoutTimeline(editedTemplate).totalDurationSec : undefined;
  const hasWalk = template.walkSec > 0;

  const startWorkout = async () => {
    if (!hasValidTiming) {
      return;
    }

    primePhaseAudio();
    setIsSaving(true);

    try {
      const timingPayload = {
        warmupSec: parsedWarmupSec,
        runSec: parsedRunSec,
        walkSec: parsedWalkSec,
        cooldownSec: parsedCooldownSec
      };

      if (serverSyncEnabled) {
        await updateWorkoutTemplate(template.id, timingPayload);
        await loadInitialData();
      } else {
        await updateLocalWorkoutTemplate(template.id, timingPayload);
      }

      clearTimingDraft();
      setActiveWorkoutTemplate({
        ...template,
        ...timingPayload
      });
      navigate(`/workout/${template.id}`);
    } catch {
      showToast(t({ en: "Could not save", ru: "Не удалось сохранить" }), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="stack">
      <section className="hero-panel">
        <div className="eyebrow">{t({ en: "Today", ru: "Сегодня" })}</div>
        <h1>{localizeTemplateName(template.name, language)}</h1>
        <div className="badge-row">
          <span className="badge">{t({ en: "Level", ru: "Уровень" })} {template.level}</span>
          <span className="badge">{progressionActionLabel(recommendation?.action, language)}</span>
        </div>
        <p className="muted">{localizeProgressionReason(recommendation?.reason, language)}</p>
        <button className="primary-action" type="button" disabled={isSaving || !hasValidTiming} onClick={() => void startWorkout()}>
          <Play aria-hidden="true" size={28} fill="currentColor" />
          {isSaving ? t({ en: "Saving...", ru: "Сохранение..." }) : t({ en: "Start workout", ru: "Начать тренировку" })}
        </button>
      </section>

      <section className="summary-grid">
        <label className="metric">
          <span className="metric-label">{t({ en: "Warmup, sec", ru: "Разминка, сек" })}</span>
          <input
            inputMode="numeric"
            type="number"
            min="0"
            max="3600"
            step="1"
            required
            value={warmupSec}
            onChange={(event) => setWarmupSec(event.target.value)}
          />
        </label>
        <label className="metric">
          <span className="metric-label">{t({ en: "Run, sec", ru: "Бег, сек" })}</span>
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="3600"
            step="1"
            required
            value={runSec}
            onChange={(event) => setRunSec(event.target.value)}
          />
        </label>
        {hasWalk ? (
          <label className="metric">
            <span className="metric-label">{t({ en: "Walk, sec", ru: "Шаг, сек" })}</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="3600"
              step="1"
              required
              value={walkSec}
              onChange={(event) => setWalkSec(event.target.value)}
            />
          </label>
        ) : null}
        <label className="metric">
          <span className="metric-label">{t({ en: "Cooldown, sec", ru: "Заминка, сек" })}</span>
          <input
            inputMode="numeric"
            type="number"
            min="0"
            max="3600"
            step="1"
            required
            value={cooldownSec}
            onChange={(event) => setCooldownSec(event.target.value)}
          />
        </label>
        {totalDurationSec !== undefined ? (
          <div className="metric metric-wide">
            <span className="metric-label">{t({ en: "Total time", ru: "Всего времени" })}</span>
            <strong>{formatTime(totalDurationSec)}</strong>
          </div>
        ) : null}
      </section>

      <ReadinessCheck onStartWorkout={() => void startWorkout()} />

      <WeeklyPlan
        recommendation={recommendation}
        serverSyncEnabled={serverSyncEnabled}
        onStartWorkout={() => void startWorkout()}
      />
    </div>
  );
}
