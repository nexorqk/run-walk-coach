import { buildWorkoutTimeline, formatTime, type WorkoutTemplate } from "@run-walk-coach/shared";

type WorkoutSummaryProps = {
  template: WorkoutTemplate;
};

export function WorkoutSummary({ template }: WorkoutSummaryProps) {
  const timeline = buildWorkoutTimeline(template);
  const hasWalk = template.walkSec > 0;

  return (
    <div className="summary-grid">
      <div className="metric">
        <span className="metric-label">Warmup</span>
        <strong>{formatTime(template.warmupSec)}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">{hasWalk ? "Run / Walk" : "Run"}</span>
        <strong>
          {formatTime(template.runSec)}
          {hasWalk ? ` / ${formatTime(template.walkSec)}` : ""}
        </strong>
      </div>
      <div className="metric">
        <span className="metric-label">Repeats</span>
        <strong>{template.repeats}</strong>
      </div>
      <div className="metric">
        <span className="metric-label">Cooldown</span>
        <strong>{formatTime(template.cooldownSec)}</strong>
      </div>
      <div className="metric metric-wide">
        <span className="metric-label">Total time</span>
        <strong>{formatTime(timeline.totalDurationSec)}</strong>
      </div>
    </div>
  );
}
