import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { updateProfile } from "../api/client.js";
import { useAppStore } from "../store/app-store.js";

export function SettingsPage() {
  const profile = useAppStore((state) => state.profile);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const [heightCm, setHeightCm] = useState(185);
  const [goalSpeedKmh, setGoalSpeedKmh] = useState(12);
  const [easyHrMin, setEasyHrMin] = useState(130);
  const [easyHrMax, setEasyHrMax] = useState(150);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (profile) {
      setHeightCm(profile.heightCm);
      setGoalSpeedKmh(profile.goalSpeedKmh);
      setEasyHrMin(profile.easyHrMin);
      setEasyHrMax(profile.easyHrMax);
    }
  }, [profile]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Saving...");

    try {
      await updateProfile({
        heightCm,
        goalSpeedKmh,
        easyHrMin,
        easyHrMax
      });
      await loadInitialData();
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings");
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">Settings</div>
        <h1>Profile</h1>
        <p className="muted">{profile?.email ?? "runner@example.com"}</p>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">Height, cm</span>
          <input
            inputMode="numeric"
            type="number"
            min="100"
            max="230"
            value={heightCm}
            onChange={(event) => setHeightCm(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="field-label">Goal speed, km/h</span>
          <input
            inputMode="decimal"
            type="number"
            min="3"
            max="25"
            step="0.1"
            value={goalSpeedKmh}
            onChange={(event) => setGoalSpeedKmh(Number(event.target.value))}
          />
        </label>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">Easy HR min</span>
          <input
            inputMode="numeric"
            type="number"
            min="60"
            max="220"
            value={easyHrMin}
            onChange={(event) => setEasyHrMin(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="field-label">Easy HR max</span>
          <input
            inputMode="numeric"
            type="number"
            min="60"
            max="230"
            value={easyHrMax}
            onChange={(event) => setEasyHrMax(Number(event.target.value))}
          />
        </label>
      </section>

      <button className="primary-action" type="submit">
        <Save aria-hidden="true" size={26} />
        Save profile
      </button>

      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
