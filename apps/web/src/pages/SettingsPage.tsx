import type { AuthProviders } from "@run-walk-coach/shared";
import { AlertTriangle, Download, FileJson, Languages, LogIn, Monitor, Moon, Save, ShieldCheck, Sun, Trash2, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteProfile,
  getAuthProviders,
  getServerExportJson,
  googleLoginUrl,
  updateProfile
} from "../api/client.js";
import { showToast } from "../components/Toaster.js";
import { retryPendingSessions } from "../sync/sync-sessions.js";
import { useAppStore } from "../store/app-store.js";
import {
  buildBrowserDataExport,
  clearBrowserProgressData,
  countExportedSessions,
  downloadJsonBackup,
  withExportPreferences,
  importBrowserDataExport
} from "../utils/data-portability.js";
import { useLanguage } from "../utils/language.js";
import { getStoredTheme, setStoredTheme, type AppTheme } from "../utils/theme.js";

export function SettingsPage() {
  const profile = useAppStore((state) => state.profile);
  const templates = useAppStore((state) => state.templates);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const updateLocalProfile = useAppStore((state) => state.updateLocalProfile);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const { language, setLanguage, t } = useLanguage();
  const [heightCm, setHeightCm] = useState(185);
  const [goalSpeedKmh, setGoalSpeedKmh] = useState(12);
  const [easyHrMin, setEasyHrMin] = useState(130);
  const [easyHrMax, setEasyHrMax] = useState(150);
  const [status, setStatus] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authProviders, setAuthProviders] = useState<AuthProviders>();
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setHeightCm(profile.heightCm);
      setGoalSpeedKmh(profile.goalSpeedKmh);
      setEasyHrMin(profile.easyHrMin);
      setEasyHrMax(profile.easyHrMax);
    }
  }, [profile]);

  useEffect(() => {
    void getAuthProviders()
      .then(setAuthProviders)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");

    if (googleStatus === "connected") {
      setAuthStatus(t({
        en: "Google account connected. Local sessions will sync when possible.",
        ru: "Google аккаунт подключён. Локальные тренировки будут синхронизироваться при возможности."
      }));
      void loadInitialData();
    } else if (googleStatus === "error") {
      setAuthStatus(t({
        en: "Google login could not be completed.",
        ru: "Не удалось завершить вход через Google."
      }));
    }

    if (googleStatus) {
      window.history.replaceState(null, "", "/settings");
    }
  }, [loadInitialData, t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(t({ en: "Saving...", ru: "Сохранение..." }));
    setIsSaving(true);

    try {
      const profilePayload = {
        heightCm,
        goalSpeedKmh,
        easyHrMin,
        easyHrMax
      };

      if (serverSyncEnabled) {
        await updateProfile(profilePayload);
        await loadInitialData();
      } else {
        updateLocalProfile(profilePayload);
      }

      setStatus(serverSyncEnabled ? t({ en: "Saved to server", ru: "Сохранено на сервер" }) : t({ en: "Saved in this browser", ru: "Сохранено в этом браузере" }));
      showToast(
        serverSyncEnabled ? t({ en: "Saved to server", ru: "Сохранено на сервер" }) : t({ en: "Saved in this browser", ru: "Сохранено в этом браузере" }),
        "success"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t({ en: "Could not save settings", ru: "Не удалось сохранить настройки" });
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
  };

  const deleteProgress = async () => {
    const confirmed = window.confirm(
      serverSyncEnabled
        ? t({
            en: "Delete server and browser progress for this Google account?",
            ru: "Удалить серверный и браузерный прогресс для этого Google аккаунта?"
          })
        : t({
            en: "Delete browser progress and settings? This cannot be undone.",
            ru: "Удалить прогресс и настройки в этом браузере? Это нельзя отменить."
          })
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProfile(true);
    setStatus(t({ en: "Deleting...", ru: "Удаление..." }));

    try {
      if (serverSyncEnabled) {
        await deleteProfile();
      }

      await clearBrowserProgressData();
      setWorkoutDraft(undefined);
      await loadInitialData();
      setStatus(t({ en: "Progress deleted", ru: "Прогресс удалён" }));
      showToast(t({ en: "Progress deleted", ru: "Прогресс удалён" }), "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : t({ en: "Could not delete progress", ru: "Не удалось удалить прогресс" });
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    setStatus(t({ en: "Preparing JSON export...", ru: "Подготовка JSON экспорта..." }));

    try {
      const data = withExportPreferences(
        serverSyncEnabled ? await getServerExportJson() : await buildBrowserDataExport(profile, templates),
        serverSyncEnabled ? "server" : "browser"
      );
      const exportedAt = typeof data.exportedAt === "string" ? data.exportedAt : undefined;
      const sessionCount = countExportedSessions(data);

      downloadJsonBackup(data, exportedAt);
      const exportMsg = t({
        en: `Exported ${sessionCount} sessions to JSON`,
        ru: `Экспортировано тренировок в JSON: ${sessionCount}`
      });
      setStatus(exportMsg);
      showToast(exportMsg, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : t({ en: "Could not export data", ru: "Не удалось экспортировать данные" });
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const confirmed = window.confirm(
      serverSyncEnabled
        ? t({
            en: "Import this JSON backup, replace browser data, and sync imported sessions to this Google account when possible?",
            ru: "Импортировать этот JSON backup, заменить данные браузера и синхронизировать импортированные тренировки с этим Google аккаунтом при возможности?"
          })
        : t({
            en: "Import this JSON backup and replace all browser progress and settings?",
            ru: "Импортировать этот JSON backup и заменить весь прогресс и настройки в браузере?"
          })
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    setIsImporting(true);
    setStatus(t({ en: "Importing JSON...", ru: "Импорт JSON..." }));

    try {
      const result = await importBrowserDataExport(
        await file.text(),
        serverSyncEnabled ? "pending" : "local"
      );

      setWorkoutDraft(undefined);
      await loadInitialData();

      if (serverSyncEnabled) {
        await retryPendingSessions(true);
        await loadInitialData();
      }

      const importMsg = t({
        en: `Imported ${result.sessionsImported} sessions and ${result.templatesImported} templates`,
        ru: `Импортировано тренировок: ${result.sessionsImported}, шаблонов: ${result.templatesImported}`
      });
      setStatus(importMsg);
      showToast(importMsg, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : t({ en: "Could not import data", ru: "Не удалось импортировать данные" });
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel">
        <div className="eyebrow">{t({ en: "Settings", ru: "Настройки" })}</div>
        <h1>{t({ en: "Profile", ru: "Профиль" })}</h1>
        <p className="muted">
          {serverSyncEnabled ? profile?.email ?? t({ en: "Google account", ru: "Google аккаунт" }) : t({ en: "Saved in this browser", ru: "Сохранено в этом браузере" })}
        </p>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>{t({ en: "Account", ru: "Аккаунт" })}</h2>
          <p className="muted">
            {profile?.googleLinkedAt
              ? `${t({ en: "Google connected", ru: "Google подключён" })} ${new Date(profile.googleLinkedAt).toLocaleDateString(language === "ru" ? "ru-RU" : undefined)}`
              : t({ en: "Connect Google to save progress on the server.", ru: "Подключи Google, чтобы сохранять прогресс на сервере." })}
          </p>
        </div>

        {!serverSyncEnabled ? (
          <div className="warning-callout">
            <AlertTriangle aria-hidden="true" size={22} />
            <p>
              {t({
                en: "Progress is saved only in this browser and can be lost if cache, cookies, or site data are cleared.",
                ru: "Прогресс хранится только в этом браузере и может пропасть при очистке кеша, cookies или данных сайта."
              })}
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
          {authProviders ? t({ en: "Continue with Google", ru: "Войти через Google" }) : t({ en: "Checking Google login...", ru: "Проверка входа через Google..." })}
        </button>

        {authProviders && !authProviders.google.enabled ? (
          <p className="muted">{t({ en: "Google login is not configured on this server.", ru: "Вход через Google не настроен на сервере." })}</p>
        ) : null}
        {authStatus ? <p className="muted">{authStatus}</p> : null}
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>{t({ en: "Display", ru: "Вид" })}</h2>
          <p className="muted">{t({ en: "Choose a theme for this browser or follow system settings.", ru: "Выбери тему для этого браузера или используй системную." })}</p>
        </div>
        <div className="segmented-control three-options" role="group" aria-label="Theme">
          <button
            className={`segment-option ${theme === "system" ? "active" : ""}`}
            type="button"
            aria-pressed={theme === "system"}
            onClick={() => changeTheme("system")}
          >
            <Monitor aria-hidden="true" size={20} />
            {t({ en: "System", ru: "Система" })}
          </button>
          <button
            className={`segment-option ${theme === "light" ? "active" : ""}`}
            type="button"
            aria-pressed={theme === "light"}
            onClick={() => changeTheme("light")}
          >
            <Sun aria-hidden="true" size={20} />
            {t({ en: "Light", ru: "Светлая" })}
          </button>
          <button
            className={`segment-option ${theme === "dark" ? "active" : ""}`}
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => changeTheme("dark")}
          >
            <Moon aria-hidden="true" size={20} />
            {t({ en: "Dark", ru: "Тёмная" })}
          </button>
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>{t({ en: "Language", ru: "Язык" })}</h2>
          <p className="muted">{t({ en: "Choose the interface language for this browser.", ru: "Выбери язык интерфейса для этого браузера." })}</p>
        </div>
        <div className="segmented-control" role="group" aria-label={t({ en: "Language", ru: "Язык" })}>
          <button
            className={`segment-option ${language === "en" ? "active" : ""}`}
            type="button"
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            <Languages aria-hidden="true" size={20} />
            English
          </button>
          <button
            className={`segment-option ${language === "ru" ? "active" : ""}`}
            type="button"
            aria-pressed={language === "ru"}
            onClick={() => setLanguage("ru")}
          >
            <Languages aria-hidden="true" size={20} />
            Русский
          </button>
        </div>
      </section>

      <section className="form-section two-column">
        <label>
          <span className="field-label">{t({ en: "Height, cm", ru: "Рост, см" })}</span>
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
          <span className="field-label">{t({ en: "Goal speed, km/h", ru: "Целевая скорость, км/ч" })}</span>
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
          <span className="field-label">{t({ en: "Easy HR min", ru: "Лёгкий пульс min" })}</span>
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
          <span className="field-label">{t({ en: "Easy HR max", ru: "Лёгкий пульс max" })}</span>
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
          <h2>{t({ en: "Data backup", ru: "Резервная копия" })}</h2>
          <p className="muted">
            {t({
              en: "Export or restore profile, templates, sessions, language, and theme as JSON.",
              ru: "Экспортируй или восстанови профиль, шаблоны, тренировки, язык и тему через JSON."
            })}
          </p>
        </div>

        <div className="warning-callout">
          <FileJson aria-hidden="true" size={22} />
          <p>
            {serverSyncEnabled
              ? t({
                  en: "Import replaces browser data first. Browser-only imported sessions will then sync to the connected Google account when possible.",
                  ru: "Импорт сначала заменит данные браузера. Локальные импортированные тренировки затем синхронизируются с подключённым Google аккаунтом при возможности."
                })
              : t({
                  en: "This is a manual backup for browser-only progress. Keep the JSON file somewhere safe.",
                  ru: "Это ручной backup для прогресса только в браузере. Храни JSON файл в безопасном месте."
                })}
          </p>
        </div>

        <div className="action-grid">
          <button
            className="secondary-action"
            type="button"
            disabled={isExporting}
            onClick={() => void exportData()}
          >
            <Download aria-hidden="true" size={23} />
            {isExporting ? t({ en: "Exporting...", ru: "Экспорт..." }) : t({ en: "Export JSON", ru: "Экспорт JSON" })}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={isImporting}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload aria-hidden="true" size={23} />
            {isImporting ? t({ en: "Importing...", ru: "Импорт..." }) : t({ en: "Import JSON", ru: "Импорт JSON" })}
          </button>
        </div>

        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importData(event)}
        />
      </section>

      <section className="form-section">
        <div className="section-heading">
          <h2>{t({ en: "Data & Privacy", ru: "Данные и приватность" })}</h2>
          <p className="muted">
            {t({
              en: "See where data is stored, what syncs, and how export or delete works.",
              ru: "Посмотри, где хранятся данные, что синхронизируется, и как работает экспорт или удаление."
            })}
          </p>
        </div>

        <Link className="secondary-action" to="/data-privacy">
          <ShieldCheck aria-hidden="true" size={23} />
          {t({ en: "Open Data & Privacy", ru: "Открыть Данные и приватность" })}
        </Link>

        <p className="muted">
          <a className="inline-link" href="/privacy.html">
            {t({ en: "Privacy policy", ru: "Политика приватности" })}
          </a>
        </p>

        <button
          className="secondary-action danger"
          type="button"
          disabled={isDeletingProfile}
          onClick={() => void deleteProgress()}
        >
          <Trash2 aria-hidden="true" size={23} />
          {isDeletingProfile ? t({ en: "Deleting...", ru: "Удаление..." }) : t({ en: "Delete progress", ru: "Удалить прогресс" })}
        </button>
      </section>

      <button className="primary-action" type="submit" disabled={isSaving}>
        <Save aria-hidden="true" size={26} />
        {isSaving ? t({ en: "Saving...", ru: "Сохранение..." }) : t({ en: "Save settings", ru: "Сохранить настройки" })}
      </button>

      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
