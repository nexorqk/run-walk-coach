import { breathingLevelValues, formatTime, type BreathingLevel } from "@run-walk-coach/shared";
import { Activity, Footprints, Gauge, HeartPulse, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { db, type LocalWorkoutSession } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";
import { breathingLabel, formatDateTime } from "../utils/labels.js";

type PulseZone = {
  name: string;
  range: string;
  tone: "easy" | "steady" | "hard" | "alert";
  description: string;
};

function pulseZones(easyMin: number, easyMax: number): PulseZone[] {
  return [
    {
      name: "Recovery",
      range: `< ${easyMin}`,
      tone: "easy",
      description: "Use this for warmup, cooldown, and days when legs feel heavy."
    },
    {
      name: "Easy run",
      range: `${easyMin}-${easyMax}`,
      tone: "easy",
      description: "Main development zone: breathing controlled, conversation possible."
    },
    {
      name: "Steady",
      range: `${easyMax + 1}-${easyMax + 15}`,
      tone: "steady",
      description: "Useful in small doses, but not the target for most run-walk sessions."
    },
    {
      name: "Hard",
      range: `${easyMax + 16}-${easyMax + 30}`,
      tone: "hard",
      description: "Short efforts only. Repeat the level if this appears often."
    },
    {
      name: "Too high",
      range: `> ${easyMax + 30}`,
      tone: "alert",
      description: "Back off to walking until breathing and pulse settle."
    }
  ];
}

function currentPulseAdvice(
  heartRate: number | undefined,
  breathing: BreathingLevel,
  easyMin: number,
  easyMax: number
) {
  if (!heartRate) {
    return "Enter current heart rate during or after a workout for a pacing cue.";
  }

  if (heartRate > easyMax + 30 || breathing === "VERY_HARD") {
    return "Switch to walking now. Resume running only after pulse and breathing drop back under control.";
  }

  if (heartRate > easyMax || breathing === "HARD") {
    return "Slow the run segment or extend the next walk. The goal is controlled effort, not speed.";
  }

  if (heartRate < easyMin && breathing === "EASY") {
    return "You are below the easy target. Stay relaxed, or progress only if the full workout feels controlled.";
  }

  return "Good training zone. Keep the current rhythm and finish with the same control.";
}

function latestSessionCue(session: LocalWorkoutSession | undefined) {
  if (!session) {
    return "Complete a workout report to unlock feedback from your own sessions.";
  }

  if (session.pain !== "NONE") {
    return "Pain was reported last time. Keep the next session easier and stop if pain changes your stride.";
  }

  if (session.difficulty >= 8 || session.breathing === "VERY_HARD") {
    return "The last session was too demanding. Repeat the level and make the walk breaks calmer.";
  }

  if (session.maxHr !== null && session.maxHr !== undefined && session.maxHr >= 170) {
    return "Max pulse was high last time. Start slower and protect the first half of the workout.";
  }

  if (session.difficulty <= 6 && ["EASY", "MEDIUM", "HARD"].includes(session.breathing)) {
    return "Last session looked controlled. One more controlled session at this level supports progression.";
  }

  return "Repeat the current level until effort, breathing, and pulse are predictable.";
}

export function CoachPage() {
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const [latestSession, setLatestSession] = useState<LocalWorkoutSession>();
  const [heartRateInput, setHeartRateInput] = useState("");
  const [breathing, setBreathing] = useState<BreathingLevel>("MEDIUM");
  const easyMin = profile?.easyHrMin ?? 130;
  const easyMax = profile?.easyHrMax ?? 150;
  const currentHeartRate = heartRateInput.trim() === "" ? undefined : Number(heartRateInput);
  const zones = useMemo(() => pulseZones(easyMin, easyMax), [easyMin, easyMax]);

  useEffect(() => {
    void db.sessions
      .orderBy("date")
      .reverse()
      .first()
      .then(setLatestSession);
  }, []);

  return (
    <div className="stack">
      <section className="hero-panel">
        <div className="eyebrow">Coach</div>
        <h1>Pulse and running guide</h1>
        <p className="muted">
          Keep most work in the easy zone, progress after controlled sessions, and use walk breaks
          before pulse turns into a fight.
        </p>
        <div className="badge-row">
          <span className="badge">
            <HeartPulse aria-hidden="true" size={16} />
            Easy HR {easyMin}-{easyMax}
          </span>
          <span className="badge">
            <Activity aria-hidden="true" size={16} />
            {serverSyncEnabled ? "Google sync on" : "Local only"}
          </span>
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Live pacing cue</h2>
          <p className="muted">Use this during a workout or right after a run segment.</p>
        </div>

        <div className="form-grid two-column">
          <label>
            <span className="field-label">Current HR</span>
            <input
              inputMode="numeric"
              type="number"
              min="40"
              max="240"
              value={heartRateInput}
              onChange={(event) => setHeartRateInput(event.target.value)}
              placeholder={`${easyMin}-${easyMax}`}
            />
          </label>
          <label>
            <span className="field-label">Breathing</span>
            <select value={breathing} onChange={(event) => setBreathing(event.target.value as BreathingLevel)}>
              {breathingLevelValues.map((value) => (
                <option key={value} value={value}>
                  {breathingLabel(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="coach-callout">
          <Gauge aria-hidden="true" size={24} />
          <p>{currentPulseAdvice(currentHeartRate, breathing, easyMin, easyMax)}</p>
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Today focus</h2>
          <p className="muted">{recommendation?.template.name ?? "Current workout"}</p>
        </div>
        <div className="coach-callout">
          <TrendingUp aria-hidden="true" size={24} />
          <p>{recommendation?.reason ?? "Stay easy and keep the run segments repeatable."}</p>
        </div>
        {recommendation ? (
          <p className="muted">
            Target: {formatTime(recommendation.template.runSec)} run /{" "}
            {formatTime(recommendation.template.walkSec)} walk. If pulse rises above {easyMax},
            shorten the run or make the walk slower.
          </p>
        ) : null}
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Pulse zones</h2>
          <p className="muted">Based on your easy HR range in Settings.</p>
        </div>
        <div className="zone-list">
          {zones.map((zone) => (
            <article className={`zone-row zone-${zone.tone}`} key={zone.name}>
              <div>
                <strong>{zone.name}</strong>
                <span>{zone.range}</span>
              </div>
              <p>{zone.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Last session readout</h2>
          <p className="muted">
            {latestSession ? formatDateTime(latestSession.date) : "No report yet"}
          </p>
        </div>
        <div className="coach-callout">
          <Footprints aria-hidden="true" size={24} />
          <p>{latestSessionCue(latestSession)}</p>
        </div>
      </section>
    </div>
  );
}
