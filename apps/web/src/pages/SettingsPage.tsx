import { buildWorkoutTimeline, formatTime, type RecoveryCodeStatus } from "@run-walk-coach/shared";
import { Download, KeyRound, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  createRecoveryCode,
  deleteProfile,
  getRecoveryCodeStatus,
  recoverWithCode,
  revokeRecoveryCode,
  updateProfile,
  updateWorkoutTemplate
} from "../api/client.js";
import { db } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";

export function SettingsPage() {
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
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
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryCodeStatus, setRecoveryCodeStatus] = useState<RecoveryCodeStatus>();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoverInput, setRecoverInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingRecoveryCode, setIsCreatingRecoveryCode] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
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
  const totalDurationSec = editedTemplate && hasValidTiming
    ? buildWorkoutTimeline(editedTemplate).totalDurationSec
    : undefined;

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
    void getRecoveryCodeStatus()
      .then(setRecoveryCodeStatus)
      .catch(() => undefined);
  }, [profile?.id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("Saving...");
    setIsSaving(true);

    try {
      const updates: Promise<unknown>[] = [
        updateProfile({
          heightCm,
          goalSpeedKmh,
          easyHrMin,
          easyHrMax
        })
      ];

      if (currentTemplate) {
        updates.push(
          updateWorkoutTemplate(currentTemplate.id, {
            warmupSec: parsedWarmupSec,
            runSec: parsedRunSec,
            walkSec: parsedWalkSec,
            cooldownSec: parsedCooldownSec
          })
        );
      }

      await Promise.all(updates);
      await loadInitialData();
      setStatus("Saved");
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

  const createCode = async () => {
    setIsCreatingRecoveryCode(true);
    setRecoveryStatus("Creating...");

    try {
      const response = await createRecoveryCode();
      setRecoveryCode(response.recoveryCode);
      setRecoveryCodeStatus({
        exists: true,
        createdAt: response.createdAt,
        lastUsedAt: null,
        revokedAt: null
      });
      setRecoveryStatus("Recovery code created");
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Could not create recovery code");
    } finally {
      setIsCreatingRecoveryCode(false);
    }
  };

  const revokeCode = async () => {
    setRecoveryStatus("Revoking...");

    try {
      setRecoveryCodeStatus(await revokeRecoveryCode());
      setRecoveryCode("");
      setRecoveryStatus("Recovery code revoked");
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Could not revoke recovery code");
    }
  };

  const downloadCode = () => {
    const createdAt = recoveryCodeStatus?.createdAt ?? new Date().toISOString();
    const contents = [
      "RunWalk Coach recovery code",
      "",
      `Recovery code: ${recoveryCode}`,
      `User: ${profile?.id ?? "unknown"}`,
      `Created: ${createdAt}`,
      "",
      "Keep this code private. Anyone with this code can restore this profile.",
      "The server stores only a hash of this code, so it cannot be shown again later."
    ].join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `runwalk-recovery-${new Date(createdAt).toISOString().slice(0, 10)}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setRecoveryStatus("Recovery code downloaded");
  };

  const recover = async () => {
    setIsRecovering(true);
    setRecoveryStatus("Recovering...");

    try {
      await recoverWithCode({ recoveryCode: recoverInput });
      await loadInitialData();
      setRecoverInput("");
      setRecoveryCode("");
      setRecoveryCodeStatus(await getRecoveryCodeStatus());
      setRecoveryStatus("Progress restored");
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Could not restore progress");
    } finally {
      setIsRecovering(false);
    }
  };

  const deleteProgress = async () => {
    const confirmed = window.confirm(
      "Delete all server and local progress for this user? This cannot be undone without a recovery code for another account."
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProfile(true);
    setRecoveryStatus("Deleting...");

    try {
      await deleteProfile();
      await db.sessions.clear();
      setWorkoutDraft(undefined);
      setRecoveryCode("");
      setRecoverInput("");
      setRecoveryCodeStatus(undefined);
      await loadInitialData();
      setRecoveryStatus("Progress deleted");
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : "Could not delete progress");
    } finally {
      setIsDeletingProfile(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">Settings</div>
        <h1>Profile</h1>
        <p className="muted">{profile?.email ?? "Anonymous runner"}</p>
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
          <h2>Recovery</h2>
          <p className="muted">{profile ? `User ${profile.id.slice(0, 8)}` : "Anonymous session"}</p>
        </div>

        <p className="muted">
          Recovery code: {recoveryCodeStatus?.exists ? "Active" : "Not created"}
          {recoveryCodeStatus?.lastUsedAt ? `, last used ${new Date(recoveryCodeStatus.lastUsedAt).toLocaleString()}` : ""}
        </p>

        <button
          className="secondary-action"
          type="button"
          disabled={isCreatingRecoveryCode}
          onClick={() => void createCode()}
        >
          <KeyRound aria-hidden="true" size={23} />
          {isCreatingRecoveryCode
            ? "Creating..."
            : recoveryCodeStatus?.exists
              ? "Rotate recovery code"
              : "Create recovery code"}
        </button>

        {recoveryCode ? (
          <>
            <label>
              <span className="field-label">Recovery code</span>
              <input readOnly value={recoveryCode} />
            </label>
            <button className="secondary-action" type="button" onClick={downloadCode}>
              <Download aria-hidden="true" size={23} />
              Download recovery code
            </button>
          </>
        ) : null}

        {recoveryCodeStatus?.exists ? (
          <button className="secondary-action" type="button" onClick={() => void revokeCode()}>
            <KeyRound aria-hidden="true" size={23} />
            Revoke recovery code
          </button>
        ) : null}

        <label>
          <span className="field-label">Restore with code</span>
          <input
            autoComplete="one-time-code"
            value={recoverInput}
            onChange={(event) => setRecoverInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && recoverInput.trim().length > 0) {
                event.preventDefault();
                void recover();
              }
            }}
            placeholder="RW-..."
          />
        </label>

        <button
          className="secondary-action"
          type="button"
          disabled={isRecovering || recoverInput.trim().length === 0}
          onClick={() => void recover()}
        >
          <KeyRound aria-hidden="true" size={23} />
          {isRecovering ? "Restoring..." : "Restore progress"}
        </button>

        {recoveryStatus ? <p className="muted">{recoveryStatus}</p> : null}
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
        Save settings
      </button>

      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
