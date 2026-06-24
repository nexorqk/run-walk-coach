import { AlertTriangle, Info, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { useAppStore } from "../store/app-store.js";
import { primePhaseAudio } from "../utils/phase-feedback.js";

export function TodayPage() {
  const navigate = useNavigate();
  const recommendation = useAppStore((state) => state.recommendation);
  const isLoading = useAppStore((state) => state.isLoading);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const setActiveWorkoutTemplate = useAppStore((state) => state.setActiveWorkoutTemplate);
  const template = recommendation?.template;

  if (isLoading && !template) {
    return (
      <section className="empty-state">
        <div className="loader" />
        <p>Loading workout...</p>
      </section>
    );
  }

  if (!template) {
    return (
      <section className="empty-state">
        <p>No workout template is available.</p>
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
        <div className="eyebrow">Today</div>
        <h1>{template.name}</h1>
        <div className="badge-row">
          <span className="badge">Level {template.level}</span>
          <span className="badge">{recommendation?.action ?? "repeat"}</span>
          <button className="badge info-badge" type="button" onClick={() => navigate("/settings")}>
            <Info aria-hidden="true" size={16} />
            Time can be changed in Settings
          </button>
        </div>
        {!serverSyncEnabled ? (
          <div className="warning-callout">
            <AlertTriangle aria-hidden="true" size={22} />
            <p>
              Progress is saved only in this browser and can be lost if cache,
              cookies, or site data are cleared.
            </p>
          </div>
        ) : null}
        <p className="muted">{recommendation?.reason}</p>
        <button className="primary-action" type="button" onClick={startWorkout}>
          <Play aria-hidden="true" size={28} fill="currentColor" />
          Start workout
        </button>
      </section>

      <WorkoutSummary template={template} />
    </div>
  );
}
