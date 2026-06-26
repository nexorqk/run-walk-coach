import {
  breathingLevelValues,
  formatTime,
  painTypeValues,
  type BreathingLevel,
  type HeartRateZone,
  type PainType,
  type UpdateWorkoutSession,
  type WorkoutSession
} from "@run-walk-coach/shared";
import { AlertTriangle, Edit3, RefreshCcw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { deleteSession, getSessions, updateSession } from "../api/client.js";
import { db, type LocalWorkoutSession, type SyncStatus } from "../db/local-db.js";
import { retryPendingSessions } from "../sync/sync-sessions.js";
import { useAppStore } from "../store/app-store.js";
import {
  breathingLabel,
  formatDateTime,
  localizeTemplateName,
  painLabel,
  syncStatusLabel,
  type AppLanguage,
  useLanguage
} from "../utils/language.js";
import {
  deriveAvgPaceSecPerKm,
  deriveAvgSpeedKmh,
  distanceMetersToKmInput,
  formatCadenceSpm,
  formatDistanceMeters,
  formatPaceSecPerKm,
  formatSpeedKmh,
  heartRateZoneLabel,
  heartRateZoneShortLabel,
  heartRateZoneValues,
  paceSecPerKmToInput,
  parseDistanceKmToMeters,
  parseOptionalFloat,
  parseOptionalInt,
  parsePaceToSecPerKm
} from "../utils/running-metrics.js";

type HistoryItem = {
  key: string;
  localId?: string;
  remoteId?: string;
  date: string;
  completed: boolean;
  templateName: string;
  templateLevel?: number;
  totalDurationSec: number;
  totalRunSec: number;
  difficulty: number;
  avgHr?: number | null;
  maxHr?: number | null;
  stopwatchPulseBpm?: number | null;
  heartRateZone?: HeartRateZone | null;
  distanceMeters?: number | null;
  avgPaceSecPerKm?: number | null;
  avgSpeedKmh?: number | null;
  cadenceSpm?: number | null;
  breathing: BreathingLevel;
  breathingNote?: string | null;
  pain: PainType;
  notes?: string | null;
  syncStatus: SyncStatus;
};

function optionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function numberInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function localToHistory(session: LocalWorkoutSession, language: AppLanguage): HistoryItem {
  return {
    key: session.localId,
    localId: session.localId,
    remoteId: session.remoteId,
    date: session.date,
    completed: session.completed,
    templateName: localizeTemplateName(session.templateName, language),
    templateLevel: session.templateLevel,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    stopwatchPulseBpm: session.stopwatchPulseBpm,
    heartRateZone: session.heartRateZone,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    breathing: session.breathing,
    breathingNote: session.breathingNote,
    pain: session.pain,
    notes: session.notes,
    syncStatus: session.syncStatus
  };
}

function remoteToHistory(session: WorkoutSession, language: AppLanguage): HistoryItem {
  return {
    key: session.id,
    remoteId: session.id,
    date: session.date,
    completed: session.completed,
    templateName: localizeTemplateName(session.template?.name, language),
    templateLevel: session.template?.level,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    difficulty: session.difficulty,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    stopwatchPulseBpm: session.stopwatchPulseBpm,
    heartRateZone: session.heartRateZone,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    breathing: session.breathing,
    breathingNote: session.breathingNote,
    pain: session.pain,
    notes: session.notes,
    syncStatus: "synced"
  };
}

function SessionEditForm({
  item,
  isSaving,
  onCancel,
  onSave
}: {
  item: HistoryItem;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (payload: UpdateWorkoutSession) => void;
}) {
  const { language, t } = useLanguage();
  const [completed, setCompleted] = useState(item.completed);
  const [difficulty, setDifficulty] = useState(item.difficulty);
  const [avgHr, setAvgHr] = useState(numberInput(item.avgHr));
  const [maxHr, setMaxHr] = useState(numberInput(item.maxHr));
  const [distanceKm, setDistanceKm] = useState(distanceMetersToKmInput(item.distanceMeters));
  const [avgPace, setAvgPace] = useState(paceSecPerKmToInput(item.avgPaceSecPerKm));
  const [avgSpeed, setAvgSpeed] = useState(numberInput(item.avgSpeedKmh));
  const [cadenceSpm, setCadenceSpm] = useState(numberInput(item.cadenceSpm));
  const [stopwatchPulseBpm, setStopwatchPulseBpm] = useState(numberInput(item.stopwatchPulseBpm));
  const [heartRateZone, setHeartRateZone] = useState<HeartRateZone | "">(item.heartRateZone ?? "");
  const [breathing, setBreathing] = useState<BreathingLevel>(item.breathing);
  const [breathingNote, setBreathingNote] = useState(item.breathingNote ?? "");
  const [pain, setPain] = useState<PainType>(item.pain);
  const [notes, setNotes] = useState(item.notes ?? "");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const distanceMeters = parseDistanceKmToMeters(distanceKm);
    const avgPaceInput = parsePaceToSecPerKm(avgPace);
    const avgSpeedInput = parseOptionalFloat(avgSpeed);

    onSave({
      completed,
      difficulty,
      avgHr: optionalNumber(avgHr),
      maxHr: optionalNumber(maxHr),
      stopwatchPulseBpm: parseOptionalInt(stopwatchPulseBpm),
      heartRateZone: heartRateZone || null,
      distanceMeters,
      avgPaceSecPerKm: avgPaceInput ?? deriveAvgPaceSecPerKm(distanceMeters, item.totalDurationSec),
      avgSpeedKmh: avgSpeedInput ?? deriveAvgSpeedKmh(distanceMeters, item.totalDurationSec),
      cadenceSpm: parseOptionalInt(cadenceSpm),
      breathing,
      breathingNote: breathingNote.trim() || null,
      pain,
      notes: notes.trim() || null
    });
  };

  return (
    <form className="session-edit-form" onSubmit={submit}>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={completed}
          onChange={(event) => setCompleted(event.target.checked)}
        />
        <span>{t({ en: "Completed", ru: "Завершена" })}</span>
      </label>

      <div>
        <span className="field-label">{t({ en: "Difficulty", ru: "Сложность" })}</span>
        <div className="difficulty-grid" role="group" aria-label={t({ en: "Difficulty 1 to 10", ru: "Сложность от 1 до 10" })}>
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
      </div>

      <div className="form-grid two-column">
        <label>
          <span className="field-label">{t({ en: "Avg HR", ru: "Средний пульс" })}</span>
          <input
            inputMode="numeric"
            min="30"
            max="240"
            type="number"
            value={avgHr}
            onChange={(event) => setAvgHr(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Max HR", ru: "Макс. пульс" })}</span>
          <input
            inputMode="numeric"
            min="30"
            max="260"
            type="number"
            value={maxHr}
            onChange={(event) => setMaxHr(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
      </div>

      <div className="form-grid two-column">
        <label>
          <span className="field-label">{t({ en: "Distance, km", ru: "Дистанция, км" })}</span>
          <input
            inputMode="decimal"
            min="0"
            step="0.01"
            type="number"
            value={distanceKm}
            onChange={(event) => setDistanceKm(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Avg pace", ru: "Средний темп" })}</span>
          <input
            inputMode="numeric"
            type="text"
            value={avgPace}
            onChange={(event) => setAvgPace(event.target.value)}
            placeholder="5:45"
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Speed, km/h", ru: "Скорость, км/ч" })}</span>
          <input
            inputMode="decimal"
            min="0.1"
            step="0.1"
            type="number"
            value={avgSpeed}
            onChange={(event) => setAvgSpeed(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Cadence, spm", ru: "Каденс, шаг/мин" })}</span>
          <input
            inputMode="numeric"
            min="50"
            max="260"
            type="number"
            value={cadenceSpm}
            onChange={(event) => setCadenceSpm(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
      </div>

      <div className="form-grid two-column">
        <label>
          <span className="field-label">{t({ en: "Pulse by stopwatch", ru: "Пульс по секундомеру" })}</span>
          <input
            inputMode="numeric"
            min="30"
            max="260"
            type="number"
            value={stopwatchPulseBpm}
            onChange={(event) => setStopwatchPulseBpm(event.target.value)}
            placeholder={t({ en: "Optional", ru: "Необязательно" })}
          />
        </label>
        <label>
          <span className="field-label">{t({ en: "Heart-rate zone", ru: "Зона пульса" })}</span>
          <select
            value={heartRateZone}
            onChange={(event) => setHeartRateZone(event.target.value as HeartRateZone | "")}
          >
            <option value="">{t({ en: "Not set", ru: "Не выбрана" })}</option>
            {heartRateZoneValues.map((value) => (
              <option key={value} value={value}>
                {heartRateZoneLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-grid two-column">
        <label>
          <span className="field-label">{t({ en: "Subjective breathing", ru: "Субъективное дыхание" })}</span>
          <select value={breathing} onChange={(event) => setBreathing(event.target.value as BreathingLevel)}>
            {breathingLevelValues.map((value) => (
              <option key={value} value={value}>
                {breathingLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{t({ en: "Pain", ru: "Боль" })}</span>
          <select value={pain} onChange={(event) => setPain(event.target.value as PainType)}>
            {painTypeValues.map((value) => (
              <option key={value} value={value}>
                {painLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span className="field-label">{t({ en: "Breathing details", ru: "Детали дыхания" })}</span>
        <textarea
          rows={3}
          value={breathingNote}
          onChange={(event) => setBreathingNote(event.target.value)}
          placeholder={t({ en: "Optional", ru: "Необязательно" })}
        />
      </label>

      <label>
        <span className="field-label">{t({ en: "Notes", ru: "Заметки" })}</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t({ en: "Optional", ru: "Необязательно" })}
        />
      </label>

      <div className="action-grid">
        <button className="secondary-action" type="button" onClick={onCancel}>
          <X aria-hidden="true" size={22} />
          {t({ en: "Cancel", ru: "Отмена" })}
        </button>
        <button className="primary-action" type="submit" disabled={isSaving}>
          <Save aria-hidden="true" size={22} />
          {isSaving ? t({ en: "Saving...", ru: "Сохранение..." }) : t({ en: "Save", ru: "Сохранить" })}
        </button>
      </div>
    </form>
  );
}

export function HistoryPage() {
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const refreshRecommendation = useAppStore((state) => state.refreshRecommendation);
  const { language, t } = useLanguage();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string>();
  const [mutatingKey, setMutatingKey] = useState<string>();
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    await retryPendingSessions(serverSyncEnabled);
    const localSessions = await db.sessions.orderBy("date").reverse().toArray();

    if (!serverSyncEnabled) {
      setItems(localSessions.map((session) => localToHistory(session, language)));
      setIsLoading(false);
      return;
    }

    try {
      const remoteSessions = await getSessions();
      const syncedRemoteIds = new Set(localSessions.map((session) => session.remoteId).filter(Boolean));
      const merged = [
        ...localSessions.map((session) => localToHistory(session, language)),
        ...remoteSessions
          .filter((session) => !syncedRemoteIds.has(session.id))
          .map((session) => remoteToHistory(session, language))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(merged);
    } catch {
      setItems(localSessions.map((session) => localToHistory(session, language)));
    } finally {
      setIsLoading(false);
    }
  }, [language, serverSyncEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveItem = async (item: HistoryItem, payload: UpdateWorkoutSession) => {
    setMutatingKey(item.key);
    setStatus(t({ en: "Saving session...", ru: "Сохранение тренировки..." }));

    try {
      if (serverSyncEnabled && item.remoteId) {
        const remote = await updateSession(item.remoteId, payload);

        if (item.localId) {
          await db.sessions.update(item.localId, {
            ...payload,
            remoteId: remote.id,
            syncStatus: "synced",
            updatedAt: new Date().toISOString()
          });
        }
      } else if (item.localId) {
        await db.sessions.update(item.localId, {
          ...payload,
          updatedAt: new Date().toISOString()
        });
      }

      setEditingKey(undefined);
      await refreshRecommendation();
      await load();
      setStatus(t({ en: "Session updated", ru: "Тренировка обновлена" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t({ en: "Could not update session", ru: "Не удалось обновить тренировку" }));
    } finally {
      setMutatingKey(undefined);
    }
  };

  const removeItem = async (item: HistoryItem) => {
    const confirmed = window.confirm(
      t({
        en: "Delete this session? This cannot be undone.",
        ru: "Удалить эту тренировку? Это нельзя отменить."
      })
    );

    if (!confirmed) {
      return;
    }

    setMutatingKey(item.key);
    setStatus(t({ en: "Deleting session...", ru: "Удаление тренировки..." }));

    try {
      if (serverSyncEnabled && item.remoteId) {
        await deleteSession(item.remoteId);
      }

      if (item.localId) {
        await db.sessions.delete(item.localId);
      }

      setEditingKey(undefined);
      await refreshRecommendation();
      await load();
      setStatus(t({ en: "Session deleted", ru: "Тренировка удалена" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t({ en: "Could not delete session", ru: "Не удалось удалить тренировку" }));
    } finally {
      setMutatingKey(undefined);
    }
  };

  return (
    <div className="stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">{t({ en: "History", ru: "История" })}</div>
          <h1>{t({ en: "Sessions", ru: "Тренировки" })}</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          title={t({ en: "Refresh history", ru: "Обновить историю" })}
        >
          <RefreshCcw aria-hidden="true" size={24} />
        </button>
      </section>

      {!serverSyncEnabled ? (
        <div className="warning-callout">
          <AlertTriangle aria-hidden="true" size={22} />
          <p>
            {t({
              en: "Without Google login, history is saved only in this browser. If browser storage, cache, cookies, or site data are cleared, all local progress will be deleted.",
              ru: "Без входа через Google история хранится только в этом браузере. Если очистить память браузера, кеш, cookies или site data, весь локальный прогресс будет удалён."
            })}
          </p>
        </div>
      ) : null}

      {status ? <p className="muted">{status}</p> : null}
      {isLoading ? <p className="muted">{t({ en: "Loading sessions...", ru: "Загрузка тренировок..." })}</p> : null}

      {!isLoading && items.length === 0 ? (
        <section className="empty-state">
          <p>{t({ en: "No sessions yet.", ru: "Тренировок пока нет." })}</p>
        </section>
      ) : null}

      <section className="list">
        {items.map((item) => (
          <article className="session-row" key={item.key}>
            <div className="session-row-main">
              <strong>{item.templateName}</strong>
              <span>{formatDateTime(item.date, language)}</span>
            </div>
            <div className="session-actions">
              <span className={`sync-pill ${item.syncStatus}`}>{syncStatusLabel(item.syncStatus, language)}</span>
              <button
                className="icon-button compact"
                type="button"
                disabled={mutatingKey === item.key}
                title={t({ en: "Edit session", ru: "Редактировать тренировку" })}
                onClick={() => setEditingKey(item.key)}
              >
                <Edit3 aria-hidden="true" size={20} />
              </button>
              <button
                className="icon-button compact danger"
                type="button"
                disabled={mutatingKey === item.key}
                title={t({ en: "Delete session", ru: "Удалить тренировку" })}
                onClick={() => void removeItem(item)}
              >
                <Trash2 aria-hidden="true" size={20} />
              </button>
            </div>
            <div className="session-stats">
              <span>{item.templateLevel ? `L${item.templateLevel}` : t({ en: "Level -", ru: "Уровень -" })}</span>
              <span>{formatTime(item.totalDurationSec)}</span>
              <span>{t({ en: "Run", ru: "Бег" })} {formatTime(item.totalRunSec)}</span>
              <span>D{item.difficulty}</span>
              <span>Avg {item.avgHr ?? "-"}</span>
              <span>Max {item.maxHr ?? "-"}</span>
              {item.distanceMeters !== null && item.distanceMeters !== undefined ? (
                <span>{formatDistanceMeters(item.distanceMeters)}</span>
              ) : null}
              {item.avgPaceSecPerKm !== null && item.avgPaceSecPerKm !== undefined ? (
                <span>{formatPaceSecPerKm(item.avgPaceSecPerKm)}</span>
              ) : null}
              {item.avgSpeedKmh !== null && item.avgSpeedKmh !== undefined ? (
                <span>{formatSpeedKmh(item.avgSpeedKmh)}</span>
              ) : null}
              {item.cadenceSpm !== null && item.cadenceSpm !== undefined ? (
                <span>{formatCadenceSpm(item.cadenceSpm)}</span>
              ) : null}
              {item.stopwatchPulseBpm !== null && item.stopwatchPulseBpm !== undefined ? (
                <span>{t({ en: "Pulse", ru: "Пульс" })} {item.stopwatchPulseBpm}</span>
              ) : null}
              {item.heartRateZone ? (
                <span>{heartRateZoneShortLabel(item.heartRateZone, language)}</span>
              ) : null}
              <span>{breathingLabel(item.breathing, language)}</span>
              <span>{painLabel(item.pain, language)}</span>
            </div>
            {item.breathingNote ? (
              <p className="session-notes">
                <strong>{t({ en: "Breathing", ru: "Дыхание" })}:</strong> {item.breathingNote}
              </p>
            ) : null}
            {item.notes ? <p className="session-notes">{item.notes}</p> : null}
            {editingKey === item.key ? (
              <SessionEditForm
                key={item.key}
                item={item}
                isSaving={mutatingKey === item.key}
                onCancel={() => setEditingKey(undefined)}
                onSave={(payload) => void saveItem(item, payload)}
              />
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
