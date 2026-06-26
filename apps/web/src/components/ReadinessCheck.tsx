import { painTypeValues, type PainType } from "@run-walk-coach/shared";
import { Activity, AlertTriangle, Bed, CheckCircle2, HeartPulse, Play, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { painLabel, type AppLanguage, useLanguage } from "../utils/language.js";
import {
  defaultReadinessCheck,
  evaluateReadiness,
  type ReadinessAction,
  type ReadinessCheckInput,
  type ReadinessIllness,
  type ReadinessReason
} from "../utils/readiness.js";
import { READINESS_CHECK_KEY } from "../utils/storage-keys.js";
import { dateKey } from "../utils/weekly-plan.js";
import { SelectField } from "./SelectField.js";

type ReadinessCheckProps = {
  onStartWorkout: () => void;
};

type StoredReadinessChecks = Record<string, ReadinessCheckInput>;

function readStoredChecks(): StoredReadinessChecks {
  try {
    const raw = localStorage.getItem(READINESS_CHECK_KEY);
    return raw ? (JSON.parse(raw) as StoredReadinessChecks) : {};
  } catch {
    return {};
  }
}

function saveStoredCheck(key: string, value: ReadinessCheckInput) {
  try {
    localStorage.setItem(READINESS_CHECK_KEY, JSON.stringify({ ...readStoredChecks(), [key]: value }));
  } catch {
    // The check still works for the current tab if persistence is blocked.
  }
}

function actionTone(action: ReadinessAction) {
  if (action === "medical" || action === "rest") return "danger";
  if (action === "walk") return "amber";
  return "good";
}

function actionIcon(action: ReadinessAction) {
  if (action === "medical") return <AlertTriangle aria-hidden="true" size={24} />;
  if (action === "rest") return <Bed aria-hidden="true" size={24} />;
  if (action === "walk") return <Activity aria-hidden="true" size={24} />;
  return <HeartPulse aria-hidden="true" size={24} />;
}

function actionTitle(action: ReadinessAction, language: AppLanguage) {
  const labels: Record<ReadinessAction, Record<AppLanguage, string>> = {
    run: { en: "Ready for the plan", ru: "Готов к плану" },
    easy: { en: "Run, but easier", ru: "Беги, но легче" },
    walk: { en: "Choose walk or bike", ru: "Лучше ходьба или велосипед" },
    rest: { en: "Rest today", ru: "Сегодня отдых" },
    medical: { en: "Stop and get help", ru: "Остановись и обратись за помощью" }
  };

  return labels[action][language];
}

function actionBody(action: ReadinessAction, language: AppLanguage) {
  const copy: Record<ReadinessAction, Record<AppLanguage, string>> = {
    run: {
      en: "Signals look good. Keep the first run segments deliberately easy.",
      ru: "Сигналы хорошие. Первые беговые отрезки всё равно держи намеренно лёгкими."
    },
    easy: {
      en: "Keep the same structure, but reduce intensity and use longer walk breaks.",
      ru: "Оставь структуру, но снизь интенсивность и делай более длинные шаговые паузы."
    },
    walk: {
      en: "Replace running with an easy walk or bike. Keep breathing calm.",
      ru: "Замени бег лёгкой ходьбой или велосипедом. Дыхание должно быть спокойным."
    },
    rest: {
      en: "Do not chase training today. Recovery protects the next useful workout.",
      ru: "Сегодня не гонись за тренировкой. Восстановление защищает следующую полезную работу."
    },
    medical: {
      en: "Chest pain, severe shortness of breath, faintness or near-fainting is not a training problem.",
      ru: "Боль в груди, сильная одышка, предобморок или почти обморок — это не тренировочная задача."
    }
  };

  return copy[action][language];
}

function reasonLabel(reason: ReadinessReason, language: AppLanguage) {
  const labels: Record<ReadinessReason, Record<AppLanguage, string>> = {
    "red-flags": { en: "red flags", ru: "красные флаги" },
    fever: { en: "fever", ru: "температура" },
    "below-neck": { en: "below-neck symptoms", ru: "симптомы ниже шеи" },
    pain: { en: "pain", ru: "боль" },
    soreness: { en: "soreness", ru: "забитость" },
    fatigue: { en: "fatigue", ru: "усталость" },
    sleep: { en: "sleep", ru: "сон" },
    stress: { en: "stress", ru: "стресс" },
    ready: { en: "ready", ru: "готов" }
  };

  return labels[reason][language];
}

function sliderLabel(value: number, language: AppLanguage) {
  if (value <= 1) return language === "ru" ? "низко" : "low";
  if (value >= 5) return language === "ru" ? "высоко" : "high";
  return String(value);
}

export function ReadinessCheck({ onStartWorkout }: ReadinessCheckProps) {
  const { language, t } = useLanguage();
  const todayKey = dateKey(new Date());
  const [check, setCheck] = useState<ReadinessCheckInput>(() => readStoredChecks()[todayKey] ?? defaultReadinessCheck);
  const [status, setStatus] = useState("");
  const result = useMemo(() => evaluateReadiness(check), [check]);
  const canStart = result.action === "run" || result.action === "easy";

  const updateCheck = (patch: Partial<ReadinessCheckInput>) => {
    setCheck((current) => ({ ...current, ...patch }));
    setStatus("");
  };

  const saveCheck = () => {
    saveStoredCheck(todayKey, check);
    setStatus(t({ en: "Readiness saved for today", ru: "Готовность на сегодня сохранена" }));
  };

  return (
    <section className="panel readiness-check">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t({ en: "Readiness", ru: "Готовность" })}</div>
          <h2>{t({ en: "Before you run", ru: "Перед тренировкой" })}</h2>
        </div>
        <p className="muted">
          {t({
            en: "Quick check for sleep, fatigue, stress, soreness, pain and illness.",
            ru: "Быстрая проверка сна, усталости, стресса, забитости, боли и самочувствия."
          })}
        </p>
      </div>

      <div className={`readiness-result readiness-${actionTone(result.action)}`}>
        {actionIcon(result.action)}
        <div>
          <strong>{actionTitle(result.action, language)} · {result.score}/100</strong>
          <p>{actionBody(result.action, language)}</p>
          <span>{result.reasons.map((reason) => reasonLabel(reason, language)).join(" · ")}</span>
        </div>
      </div>

      <div className="readiness-grid">
        <label>
          <span className="field-label">{t({ en: "Sleep quality", ru: "Качество сна" })}: {sliderLabel(check.sleepQuality, language)}</span>
          <input
            type="range"
            min="1"
            max="5"
            value={check.sleepQuality}
            onChange={(event) => updateCheck({ sleepQuality: Number(event.target.value) })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Fatigue", ru: "Усталость" })}: {sliderLabel(check.fatigue, language)}</span>
          <input
            type="range"
            min="1"
            max="5"
            value={check.fatigue}
            onChange={(event) => updateCheck({ fatigue: Number(event.target.value) })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Stress", ru: "Стресс" })}: {sliderLabel(check.stress, language)}</span>
          <input
            type="range"
            min="1"
            max="5"
            value={check.stress}
            onChange={(event) => updateCheck({ stress: Number(event.target.value) })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Leg soreness", ru: "Забитость ног" })}: {sliderLabel(check.soreness, language)}</span>
          <input
            type="range"
            min="1"
            max="5"
            value={check.soreness}
            onChange={(event) => updateCheck({ soreness: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="form-grid two-column">
        <SelectField
          label={t({ en: "Pain", ru: "Боль" })}
          value={check.pain}
          options={painTypeValues.map((v) => ({ value: v, label: painLabel(v, language) }))}
          onChange={(value) => updateCheck({ pain: value as PainType })}
        />
        <SelectField
          label={t({ en: "Illness", ru: "Самочувствие" })}
          value={check.illness}
          options={[
            { value: "none", label: t({ en: "No illness", ru: "Не болею" }) },
            { value: "above_neck", label: t({ en: "Mild above-neck symptoms", ru: "Лёгкие симптомы выше шеи" }) },
            { value: "below_neck", label: t({ en: "Below-neck symptoms", ru: "Симптомы ниже шеи" }) },
            { value: "fever", label: t({ en: "Fever / body aches", ru: "Температура / ломота" }) }
          ]}
          onChange={(value) => updateCheck({ illness: value as ReadinessIllness })}
        />
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={check.redFlags}
          onChange={(event) => updateCheck({ redFlags: event.target.checked })}
        />
        <span>
          {t({
            en: "Chest pain, severe shortness of breath, faintness, dizziness, or near-fainting",
            ru: "Боль в груди, сильная одышка, предобморок, головокружение или почти обморок"
          })}
        </span>
      </label>

      <div className="action-grid">
        <button className="secondary-action" type="button" onClick={saveCheck}>
          <Save aria-hidden="true" size={22} />
          {t({ en: "Save check", ru: "Сохранить проверку" })}
        </button>
        <button className="primary-action" type="button" disabled={!canStart} onClick={onStartWorkout}>
          {canStart ? <Play aria-hidden="true" size={24} fill="currentColor" /> : <CheckCircle2 aria-hidden="true" size={24} />}
          {canStart ? t({ en: "Start workout", ru: "Начать тренировку" }) : t({ en: "Skip run today", ru: "Сегодня без бега" })}
        </button>
      </div>

      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}
