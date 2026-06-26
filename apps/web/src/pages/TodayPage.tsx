import { AlertTriangle, Info, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReadinessCheck } from "../components/ReadinessCheck.js";
import { WeeklyPlan } from "../components/WeeklyPlan.js";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { useAppStore } from "../store/app-store.js";
import {
  localizeProgressionReason,
  localizeTemplateName,
  progressionActionLabel,
  useLanguage
} from "../utils/language.js";
import { primePhaseAudio } from "../utils/phase-feedback.js";

export function TodayPage() {
  const navigate = useNavigate();
  const recommendation = useAppStore((state) => state.recommendation);
  const isLoading = useAppStore((state) => state.isLoading);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const setActiveWorkoutTemplate = useAppStore((state) => state.setActiveWorkoutTemplate);
  const { language, t } = useLanguage();
  const template = recommendation?.template;

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

  const startWorkout = () => {
    primePhaseAudio();
    setActiveWorkoutTemplate(template);
    navigate(`/workout/${template.id}`);
  };

  return (
    <div className="stack">
      <section className="hero-panel">
        <div className="eyebrow">{t({ en: "Today", ru: "Сегодня" })}</div>
        <h1>{localizeTemplateName(template.name, language)}</h1>
        <div className="badge-row">
          <span className="badge">{t({ en: "Level", ru: "Уровень" })} {template.level}</span>
          <span className="badge">{progressionActionLabel(recommendation?.action, language)}</span>
          <button className="badge info-badge" type="button" onClick={() => navigate("/settings")}>
            <Info aria-hidden="true" size={16} />
            {t({ en: "Time can be changed in Settings", ru: "Время меняется в настройках" })}
          </button>
        </div>
        {!serverSyncEnabled ? (
          <div className="warning-callout">
            <AlertTriangle aria-hidden="true" size={22} />
            <p>
              {t({
                en: "Progress is saved only in this browser and can be lost if cache, cookies, or site data are cleared.",
                ru: "Прогресс хранится только в этом браузере и может пропасть при очистке кеша, cookies или данных сайта."
              })}
            </p>
          </div>
        ) : null}
        <p className="muted">{localizeProgressionReason(recommendation?.reason, language)}</p>
        <button className="primary-action" type="button" onClick={startWorkout}>
          <Play aria-hidden="true" size={28} fill="currentColor" />
          {t({ en: "Start workout", ru: "Начать тренировку" })}
        </button>
      </section>

      <WorkoutSummary template={template} />

      <ReadinessCheck onStartWorkout={startWorkout} />

      <WeeklyPlan
        recommendation={recommendation}
        serverSyncEnabled={serverSyncEnabled}
        onStartWorkout={startWorkout}
      />
    </div>
  );
}
