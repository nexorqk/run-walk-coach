import { buildWorkoutTimeline, formatTime, type WorkoutTemplate } from "@run-walk-coach/shared";
import { useLanguage } from "../utils/language.js";

type WorkoutSummaryProps = {
  template: WorkoutTemplate;
};

export function WorkoutSummary({ template }: WorkoutSummaryProps) {
  const { t } = useLanguage();
  const timeline = buildWorkoutTimeline(template);
  const hasWalk = template.walkSec > 0;

  return (
    <div className="summary-grid">
      <div className="metric">
        <span className="metric-label">{t({ en: "Warmup", ru: "Разминка" })}</span>
        <strong>{formatTime(template.warmupSec)}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">
          {hasWalk ? t({ en: "Run / Walk", ru: "Бег / шаг" }) : t({ en: "Run", ru: "Бег" })}
        </span>
        <strong>
          {formatTime(template.runSec)}
          {hasWalk ? ` / ${formatTime(template.walkSec)}` : ""}
        </strong>
      </div>
      <div className="metric">
        <span className="metric-label">{t({ en: "Repeats", ru: "Повторы" })}</span>
        <strong>{template.repeats}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">{t({ en: "Cooldown", ru: "Заминка" })}</span>
        <strong>{formatTime(template.cooldownSec)}</strong>
      </div>
      <div className="metric metric-wide">
        <span className="metric-label">{t({ en: "Total time", ru: "Всего времени" })}</span>
        <strong>{formatTime(timeline.totalDurationSec)}</strong>
      </div>
    </div>
  );
}
