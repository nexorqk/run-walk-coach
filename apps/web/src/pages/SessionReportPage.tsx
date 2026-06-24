import {
  breathingLevelValues,
  painTypeValues,
  type BreathingLevel,
  type PainType
} from "@run-walk-coach/shared";
import { Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { saveSessionOfflineFirst } from "../sync/sync-sessions.js";
import { useAppStore } from "../store/app-store.js";
import { breathingLabel, painLabel } from "../utils/labels.js";

function optionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export function SessionReportPage() {
  const navigate = useNavigate();
  const draft = useAppStore((state) => state.workoutDraft);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const refreshRecommendation = useAppStore((state) => state.refreshRecommendation);
  const [difficulty, setDifficulty] = useState(5);
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [breathing, setBreathing] = useState<BreathingLevel>("MEDIUM");
  const [pain, setPain] = useState<PainType>("NONE");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!draft) {
    return (
      <section className="empty-state">
        <p>No finished workout is waiting for a report.</p>
        <Link className="inline-link" to="/today">
          Go to today
        </Link>
      </section>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    await saveSessionOfflineFirst(
      {
        templateId: draft.template.id,
        date: draft.date,
        completed: draft.completed,
        totalDurationSec: draft.totalDurationSec,
        totalRunSec: draft.totalRunSec,
        totalWalkSec: draft.totalWalkSec,
        avgHr: optionalNumber(avgHr),
        maxHr: optionalNumber(maxHr),
        difficulty,
        breathing,
        pain,
        notes: notes.trim() || null
      },
      draft.template,
      serverSyncEnabled
    );

    setWorkoutDraft(undefined);
    await refreshRecommendation();
    navigate("/history");
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">Report</div>
        <h1>How did it feel?</h1>
        <p className="muted">{draft.template.name}</p>
      </section>

      <section className="form-section">
        <label className="field-label">Difficulty</label>
        <div className="difficulty-grid" role="group" aria-label="Difficulty 1 to 10">
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
          <span className="field-label">Avg HR</span>
          <input
            inputMode="numeric"
            min="30"
            max="240"
            type="number"
            value={avgHr}
            onChange={(event) => setAvgHr(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          <span className="field-label">Max HR</span>
          <input
            inputMode="numeric"
            min="30"
            max="260"
            type="number"
            value={maxHr}
            onChange={(event) => setMaxHr(event.target.value)}
            placeholder="Optional"
          />
        </label>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">Breathing</span>
          <select
            value={breathing}
            onChange={(event) => setBreathing(event.target.value as BreathingLevel)}
          >
            {breathingLevelValues.map((value) => (
              <option key={value} value={value}>
                {breathingLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Pain</span>
          <select value={pain} onChange={(event) => setPain(event.target.value as PainType)}>
            {painTypeValues.map((value) => (
              <option key={value} value={value}>
                {painLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="form-section">
        <label>
          <span className="field-label">Notes</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </label>
      </section>

      <button className="primary-action" type="submit" disabled={isSaving}>
        <Save aria-hidden="true" size={26} />
        {isSaving ? "Saving..." : "Save session"}
      </button>
    </form>
  );
}
