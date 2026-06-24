import { buildWorkoutTimeline, formatTime, type AuthProviders } from "@run-walk-coach/shared";
import { AlertTriangle, LogIn, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  deleteProfile,
  getAuthProviders,
  googleLoginUrl,
  updateProfile,
  updateWorkoutTemplate
} from "../api/client.js";
import { db } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";

const LOCAL_PROFILE_KEY = "runWalkCoach.localProfile";
const LOCAL_TEMPLATES_KEY = "runWalkCoach.localTemplates";

export function SettingsPage() {
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const updateLocalProfile = useAppStore((state) => state.updateLocalProfile);
  const updateLocalWorkoutTemplate = useAppStore((state) => state.updateLocalWorkoutTemplate);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const [heightCm, setHeightCm] = useState(185);
  const [goalSpeedKmh, setGoalSpeedKmh] = useState(12);
  const [easyHrMin, setEasyHrMin] = useState(130);
  const [easyHrMax, setEasyHrMax] = useState(150);
  const [warmupSec, setWarmupSec] = useState("600");
  const [runSec, setRunSec] = useState("30");
  const [walkSec, setWalkSec] = useState("90");
  const [cooldownSec, setCooldownSec] = useState("300");
  const [status, setStatus] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authProviders, setAuthProviders] = useState<AuthProviders>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const currentTemplate = recommendation?.template;
  const parsedWarmupSec = Number(warmupSec);
  const parsedRunSec = Number(runSec);
  const parsedWalkSec = Number(walkSec);
  const parsedCooldownSec = Number(cooldownSec);
  const hasValidTiming =
    warmupSec.trim() !== "" &&
    runSec.trim() !== "" &&
    walkSec.trim() !== "" &&
    cooldownSec.trim() !== "" &&
    Number.isFinite(parsedWarmupSec) &&
    Number.isFinite(parsedRunSec) &&
    Number.isFinite(parsedWalkSec) &&
    Number.isFinite(parsedCooldownSec);
  const editedTemplate = currentTemplate
    ? {
        ...currentTemplate,
        warmupSec: hasValidTiming ? parsedWarmupSec : currentTemplate.warmupSec,
        runSec: hasValidTiming ? parsedRunSec : currentTemplate.runSec,
        walkSec: hasValidTiming ? parsedWalkSec : currentTemplate.walkSec,
        cooldownSec: hasValidTiming ? parsedCooldownSec : currentTemplate.cooldownSec
      }
    : undefined;
  const totalDurationSec =
    editedTemplate && hasValidTiming ? buildWorkoutTimeline(editedTemplate).totalDurationSec : undefined;

  useEffect(() => {
    if (profile) {
      setHeightCm(profile.heightCm);
      setGoalSpeedKmh(profile.goalSpeedKmh);
      setEasyHrMin(profile.easyHrMin);
      setEasyHrMax(profile.easyHrMax);
    }
  }, [profile]);

  useEffect(() => {
    if (currentTemplate) {
      setWarmupSec(String(currentTemplate.warmupSec));
      setRunSec(String(currentTemplate.runSec));
      setWalkSec(String(currentTemplate.walkSec));
      setCooldownSec(String(currentTemplate.cooldownSec));
    }
  }, [currentTemplate]);

  useEffect(() => {
    void getAuthProviders()
      .then(setAuthProviders)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");

    if (googleStatus === "connected") {
      setAuthStatus("Google account connected. Local sessions will sync when possible.");
      void loadInitialData();
    } else if (googleStatus === "error") {
      setAuthStatus("Google login could not be completed.");
    }

    if (googleStatus) {
      window.history.replaceState(null, "", "/settings");
    }
  }, [loadInitialData]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Saving...");
    setIsSaving(true);

    try {
      const profilePayload = {
        heightCm,
        goalSpeedKmh,
        easyHrMin,
        easyHrMax
      };
      const timingPayload = {
        warmupSec: parsedWarmupSec,
        runSec: parsedRunSec,
        walkSec: parsedWalkSec,
        cooldownSec: parsedCooldownSec
      };

      if (serverSyncEnabled) {
        const updates: Promise<unknown>[] = [updateProfile(profilePayload)];

        if (currentTemplate) {
          updates.push(updateWorkoutTemplate(currentTemplate.id, timingPayload));
        }

        await Promise.all(updates);
        await loadInitialData();
      } else {
        updateLocalProfile(profilePayload);

        if (currentTemplate) {
          await updateLocalWorkoutTemplate(currentTemplate.id, timingPayload);
        }
      }

      setStatus(serverSyncEnabled ? "Saved to server" : "Saved in this browser");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const normalizeTimingInput = (value: string, setter: (value: string) => void) => {
    if (value.trim() === "") {
      return;
    }

    setter(String(Number(value)));
  };

  const deleteProgress = async () => {
    const confirmed = window.confirm(
      serverSyncEnabled
        ? "Delete server and browser progress for this Google account?"
        : "Delete browser progress and settings? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProfile(true);
    setStatus("Deleting...");

    try {
      if (serverSyncEnabled) {
        await deleteProfile();
      }

      await db.sessions.clear();
      localStorage.removeItem(LOCAL_PROFILE_KEY);
      localStorage.removeItem(LOCAL_TEMPLATES_KEY);
      setWorkoutDraft(undefined);
      await loadInitialData();
      setStatus("Progress deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete progress");
    } finally {
      setIsDeletingProfile(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">Settings</div>
        <h1>Profile</h1>
        <p className="muted">
          {serverSyncEnabled ? profile?.email ?? "Google account" : "Saved in this browser"}
        </p>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Account</h2>
          <p className="muted">
            {profile?.googleLinkedAt
              ? `Google connected ${new Date(profile.googleLinkedAt).toLocaleDateString()}`
              : "Connect Google to save progress on the server."}
          </p>
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

        <button
          className="secondary-action"
          type="button"
          disabled={!authProviders?.google.enabled}
          onClick={() => window.location.assign(googleLoginUrl())}
        >
          <LogIn aria-hidden="true" size={23} />
          {authProviders ? "Continue with Google" : "Checking Google login..."}
        </button>

        {authProviders && !authProviders.google.enabled ? (
          <p className="muted">Google login is not configured on this server.</p>
        ) : null}
        {authStatus ? <p className="muted">{authStatus}</p> : null}
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

      <section className="form-section">
        <div className="section-heading">
          <h2>Workout timing</h2>
          <p className="muted">{currentTemplate?.name ?? "Loading workout"}</p>
        </div>

        <div className="form-grid two-column">
          <label>
            <span className="field-label">Warmup, sec</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="3600"
              step="1"
              required
              value={warmupSec}
              onBlur={() => normalizeTimingInput(warmupSec, setWarmupSec)}
              onChange={(event) => setWarmupSec(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Run, sec</span>
            <input
              inputMode="numeric"
              type="number"
              min="1"
              max="3600"
              step="1"
              required
              value={runSec}
              onBlur={() => normalizeTimingInput(runSec, setRunSec)}
              onChange={(event) => setRunSec(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Walk, sec</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="3600"
              step="1"
              required
              value={walkSec}
              onBlur={() => normalizeTimingInput(walkSec, setWalkSec)}
              onChange={(event) => setWalkSec(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Cooldown, sec</span>
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="3600"
              step="1"
              required
              value={cooldownSec}
              onBlur={() => normalizeTimingInput(cooldownSec, setCooldownSec)}
              onChange={(event) => setCooldownSec(event.target.value)}
            />
          </label>
        </div>

        {totalDurationSec !== undefined ? (
          <p className="muted">Total time: {formatTime(totalDurationSec)}</p>
        ) : null}
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>Privacy</h2>
          <p className="muted">
            <a className="inline-link" href="/privacy.html">
              Privacy policy
            </a>
          </p>
        </div>

        <button
          className="secondary-action danger"
          type="button"
          disabled={isDeletingProfile}
          onClick={() => void deleteProgress()}
        >
          <Trash2 aria-hidden="true" size={23} />
          {isDeletingProfile ? "Deleting..." : "Delete progress"}
        </button>
      </section>

      <button className="primary-action" type="submit" disabled={isSaving}>
        <Save aria-hidden="true" size={26} />
        {isSaving ? "Saving..." : "Save settings"}
      </button>

      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
