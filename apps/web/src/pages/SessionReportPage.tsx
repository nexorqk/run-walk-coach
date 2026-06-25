import {
  breathingLevelValues,
  painTypeValues,
  type BreathingLevel,
  type PainType
} from "@run-walk-coach/shared";
import { ArrowRight, HeartPulse, History, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { saveSessionOfflineFirst } from "../sync/sync-sessions.js";
import { useAppStore } from "../store/app-store.js";
import {
  breathingLabel,
  localizeTemplateName,
  painLabel,
  text,
  type AppLanguage,
  useLanguage
} from "../utils/language.js";

function optionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

type SavedReport = {
  completed: boolean;
  difficulty: number;
  breathing: BreathingLevel;
  pain: PainType;
  avgHr: number | null;
  maxHr: number | null;
  templateName?: string;
  templateLevel?: number;
};

type AdviceTone = "good" | "caution" | "danger";

type PostWorkoutAdvice = {
  tone: AdviceTone;
  title: string;
  body: string;
  next: string;
};

function buildPostWorkoutAdvice(
  report: SavedReport,
  easyHrMax: number,
  language: AppLanguage,
  nextAction?: string
): PostWorkoutAdvice {
  const t = (copy: Record<AppLanguage, string>) => text(language, copy);
  const maxHr = report.maxHr;
  const avgHr = report.avgHr;

  if (!report.completed) {
    return {
      tone: "caution",
      title: t({ en: "Keep this level", ru: "Оставь этот уровень" }),
      body: t({
        en: "The session was not fully completed, so this is a signal to keep the next workout easier and repeat the current load.",
        ru: "Тренировка не была полностью завершена, поэтому следующую лучше сделать легче и повторить текущую нагрузку."
      }),
      next: t({
        en: "Use run-walk earlier, keep breathing controlled, and avoid chasing speed.",
        ru: "Раньше переходи на шаг, держи дыхание под контролем и не гонись за скоростью."
      })
    };
  }

  if (report.pain !== "NONE") {
    return {
      tone: "danger",
      title: t({ en: "Do not progress yet", ru: "Пока не усложняй" }),
      body: t({
        en: "Pain is more important than pace or heart rate. Treat this as a recovery signal.",
        ru: "Боль важнее темпа и пульса. Считай это сигналом к восстановлению."
      }),
      next: t({
        en: "Repeat or reduce the level, add an easy day, and stop if the same pain returns.",
        ru: "Повтори или снизь уровень, добавь лёгкий день и остановись, если такая же боль вернётся."
      })
    };
  }

  if (maxHr !== null && maxHr >= 170) {
    return {
      tone: "caution",
      title: t({ en: "Heart rate was too high", ru: "Пульс был слишком высоким" }),
      body: t({
        en: "This was probably above the aerobic target. The priority is a calmer effort, not a faster split.",
        ru: "Скорее всего, это выше аэробной цели. Приоритет сейчас — спокойнее усилие, а не более быстрый отрезок."
      }),
      next: t({
        en: "Start slower, add walk breaks sooner, and let HR drop before the next run interval.",
        ru: "Начинай медленнее, раньше добавляй шаг и жди снижения пульса перед следующим беговым отрезком."
      })
    };
  }

  if (maxHr !== null && maxHr > easyHrMax + 10) {
    return {
      tone: "caution",
      title: t({ en: "Above your easy zone", ru: "Выше лёгкой зоны" }),
      body: t({
        en: "The session is still useful, but it was not fully easy aerobic work.",
        ru: "Тренировка всё равно полезная, но это была не полностью лёгкая аэробная работа."
      }),
      next: t({
        en: "Repeat this level and make the run segments noticeably slower.",
        ru: "Повтори этот уровень и сделай беговые отрезки заметно медленнее."
      })
    };
  }

  if (avgHr !== null && avgHr > easyHrMax + 5) {
    return {
      tone: "caution",
      title: t({ en: "Average effort drifted up", ru: "Среднее усилие уплыло вверх" }),
      body: t({
        en: "Your average heart rate suggests the load was steady-hard rather than easy.",
        ru: "Средний пульс показывает, что нагрузка была скорее умеренно-тяжёлой, а не лёгкой."
      }),
      next: t({
        en: "Keep the same structure next time and use walking to bring the average down.",
        ru: "В следующий раз оставь ту же структуру и используй шаг, чтобы снизить средний пульс."
      })
    };
  }

  if (report.breathing === "VERY_HARD" || report.difficulty >= 8) {
    return {
      tone: "caution",
      title: t({ en: "Too much strain", ru: "Слишком тяжёлая нагрузка" }),
      body: t({
        en: "Breathing and difficulty say the session was close to a hard workout.",
        ru: "Дыхание и сложность показывают, что тренировка была близка к тяжёлой."
      }),
      next: t({
        en: "Repeat the level and keep the next session at 5-6 out of 10.",
        ru: "Повтори уровень и держи следующую тренировку на 5–6 из 10."
      })
    };
  }

  if (nextAction === "progress") {
    return {
      tone: "good",
      title: t({ en: "Ready to progress", ru: "Можно прогрессировать" }),
      body: t({
        en: "The session looks controlled: no pain, manageable effort, and heart rate stayed in a useful range.",
        ru: "Тренировка выглядит контролируемой: без боли, усилие управляемое, пульс в полезном диапазоне."
      }),
      next: t({
        en: "Try the next level, but keep the first minutes deliberately easy.",
        ru: "Попробуй следующий уровень, но первые минуты намеренно держи очень лёгкими."
      })
    };
  }

  return {
    tone: "good",
    title: t({ en: "Good aerobic work", ru: "Хорошая аэробная работа" }),
    body: t({
      en: "The result is useful for building running durability. Controlled repetition matters more than speed right now.",
      ru: "Это полезная работа для беговой выносливости. Сейчас контролируемое повторение важнее скорости."
    }),
    next: t({
      en: "Repeat the plan until two calm sessions in a row are complete.",
      ru: "Повторяй план, пока не получатся две спокойные тренировки подряд."
    })
  };
}

function adviceClassName(tone: AdviceTone) {
  if (tone === "danger") {
    return "coach-callout coach-callout-danger";
  }

  if (tone === "caution") {
    return "coach-callout coach-callout-amber";
  }

  return "coach-callout";
}

export function SessionReportPage() {
  const draft = useAppStore((state) => state.workoutDraft);
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const refreshRecommendation = useAppStore((state) => state.refreshRecommendation);
  const { language, t } = useLanguage();
  const [difficulty, setDifficulty] = useState(5);
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [breathing, setBreathing] = useState<BreathingLevel>("MEDIUM");
  const [pain, setPain] = useState<PainType>("NONE");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedReport, setSavedReport] = useState<SavedReport>();

  if (savedReport) {
    const advice = buildPostWorkoutAdvice(
      savedReport,
      profile?.easyHrMax ?? 150,
      language,
      recommendation?.action
    );

    return (
      <div className="stack">
        <section className="panel">
          <div className="eyebrow">{t({ en: "Coach", ru: "Тренер" })}</div>
          <h1>{t({ en: "Session saved", ru: "Тренировка сохранена" })}</h1>
          <p className="muted">
            {savedReport.templateName
              ? localizeTemplateName(savedReport.templateName, language)
              : t({ en: "Workout report", ru: "Отчёт тренировки" })}
          </p>
        </section>

        <section className={adviceClassName(advice.tone)}>
          <HeartPulse aria-hidden="true" size={25} />
          <div className="coach-copy">
            <h2>{advice.title}</h2>
            <p>{advice.body}</p>
            <p className="muted">{advice.next}</p>
          </div>
        </section>

        <section className="summary-grid">
          <div className="metric">
            <span className="metric-label">{t({ en: "Difficulty", ru: "Сложность" })}</span>
            <strong>{savedReport.difficulty}/10</strong>
          </div>
          <div className="metric">
            <span className="metric-label">{t({ en: "Breathing", ru: "Дыхание" })}</span>
            <strong>{breathingLabel(savedReport.breathing, language)}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">{t({ en: "Max HR", ru: "Макс. пульс" })}</span>
            <strong>{savedReport.maxHr ?? "-"}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">{t({ en: "Pain", ru: "Боль" })}</span>
            <strong>{painLabel(savedReport.pain, language)}</strong>
          </div>
        </section>

        <div className="action-grid">
          <Link className="secondary-action" to="/history">
            <History aria-hidden="true" size={23} />
            {t({ en: "History", ru: "История" })}
          </Link>
          <Link className="primary-action" to="/today">
            <ArrowRight aria-hidden="true" size={24} />
            {t({ en: "Next workout", ru: "Следующая" })}
          </Link>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <section className="empty-state">
        <p>{t({ en: "No finished workout is waiting for a report.", ru: "Нет завершённой тренировки для отчёта." })}</p>
        <Link className="inline-link" to="/today">
          {t({ en: "Go to today", ru: "Перейти на сегодня" })}
        </Link>
      </section>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    const avgHrValue = optionalNumber(avgHr);
    const maxHrValue = optionalNumber(maxHr);
    const payload = {
      templateId: draft.template.id,
      date: draft.date,
      completed: draft.completed,
      totalDurationSec: draft.totalDurationSec,
      totalRunSec: draft.totalRunSec,
      totalWalkSec: draft.totalWalkSec,
      avgHr: avgHrValue,
      maxHr: maxHrValue,
      difficulty,
      breathing,
      pain,
      notes: notes.trim() || null
    };

    try {
      await saveSessionOfflineFirst(payload, draft.template, serverSyncEnabled);
      setWorkoutDraft(undefined);
      await refreshRecommendation();
      setSavedReport({
        completed: draft.completed,
        difficulty,
        breathing,
        pain,
        avgHr: avgHrValue,
        maxHr: maxHrValue,
        templateName: draft.template.name,
        templateLevel: draft.template.level
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t({ en: "Could not save session", ru: "Не удалось сохранить тренировку" }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">{t({ en: "Report", ru: "Отчёт" })}</div>
        <h1>{t({ en: "How did it feel?", ru: "Как прошла тренировка?" })}</h1>
        <p className="muted">{localizeTemplateName(draft.template.name, language)}</p>
      </section>

      <section className="form-section">
        <label className="field-label">{t({ en: "Difficulty", ru: "Сложность" })}</label>
        <div className="difficulty-grid" role="group" aria-label={t({ en: "Difficulty 1 to 10", ru: "Сложность от 1 до 10" })}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              className={value === difficulty ? "difficulty active" : "difficulty"}
              type="button"
              key={value}
              onClick={() => setDifficulty(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">{t({ en: "Avg HR", ru: "Средний пульс" })}</span>
          <input
            inputMode="numeric"
            min="30"
            max="240"
            type="number"
            value={avgHr}
            onChange={(event) => setAvgHr(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Max HR", ru: "Макс. пульс" })}</span>
          <input
            inputMode="numeric"
            min="30"
            max="260"
            type="number"
            value={maxHr}
            onChange={(event) => setMaxHr(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">{t({ en: "Breathing", ru: "Дыхание" })}</span>
          <select
            value={breathing}
            onChange={(event) => setBreathing(event.target.value as BreathingLevel)}
          >
            {breathingLevelValues.map((value) => (
              <option key={value} value={value}>
                {breathingLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t({ en: "Pain", ru: "Боль" })}</span>
          <select value={pain} onChange={(event) => setPain(event.target.value as PainType)}>
            {painTypeValues.map((value) => (
              <option key={value} value={value}>
                {painLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="form-section">
        <label>
          <span className="field-label">{t({ en: "Notes", ru: "Заметки" })}</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
      </section>

      <button className="primary-action" type="submit" disabled={isSaving}>
        <Save aria-hidden="true" size={26} />
        {isSaving ? t({ en: "Saving...", ru: "Сохранение..." }) : t({ en: "Save session", ru: "Сохранить тренировку" })}
      </button>

      {saveError ? <p className="muted">{saveError}</p> : null}
    </form>
  );
}
