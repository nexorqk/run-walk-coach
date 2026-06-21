import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WorkoutSummary } from "../components/WorkoutSummary.js";
import { useAppStore } from "../store/app-store.js";

export function TodayPage() {
  const navigate = useNavigate();
  const recommendation = useAppStore((state) => state.recommendation);
  const isLoading = useAppStore((state) => state.isLoading);
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
        </div>
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
