import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  FileJson,
  History,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2
} from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteProfile, getServerExportJson } from "../api/client.js";
import { db } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";
import {
  buildBrowserDataExport,
  clearBrowserProgressData,
  countExportedSessions,
  downloadJsonBackup,
  withExportPreferences
} from "../utils/data-portability.js";
import { useLanguage } from "../utils/language.js";

type DataCard = {
  title: string;
  body: string;
  meta?: string;
  icon: ReactElement;
  tone?: "default" | "good" | "amber" | "danger";
};

function DataCardGrid({ cards }: { cards: DataCard[] }) {
  return (
    <div className="privacy-card-grid">
      {cards.map((card) => (
        <article className={`privacy-card privacy-card-${card.tone ?? "default"}`} key={card.title}>
          <div className="privacy-card-heading">
            {card.icon}
            <h3>{card.title}</h3>
          </div>
          <p>{card.body}</p>
          {card.meta ? <span>{card.meta}</span> : null}
        </article>
      ))}
    </div>
  );
}

export function DataPrivacyPage() {
  const profile = useAppStore((state) => state.profile);
  const templates = useAppStore((state) => state.templates);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const setWorkoutDraft = useAppStore((state) => state.setWorkoutDraft);
  const { t } = useLanguage();
  const [browserSessionsCount, setBrowserSessionsCount] = useState(0);
  const [status, setStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void db.sessions.count().then(setBrowserSessionsCount).catch(() => setBrowserSessionsCount(0));
  }, []);

  const storageCards: DataCard[] = [
    {
      title: t({ en: "This browser", ru: "Этот браузер" }),
      body: t({
        en: "Workout history is stored in IndexedDB. Profile, workout settings, weekly plan choices, readiness checks, language and theme use browser storage.",
        ru: "История тренировок хранится в IndexedDB. Профиль, настройки тренировок, выборы недельного плана, проверки готовности, язык и тема используют хранилище браузера."
      }),
      meta: t({
        en: `${browserSessionsCount} browser sessions`,
        ru: `Тренировок в браузере: ${browserSessionsCount}`
      }),
      icon: <Smartphone aria-hidden="true" size={22} />,
      tone: "good"
    },
    {
      title: t({ en: "Server", ru: "Сервер" }),
      body: serverSyncEnabled
        ? t({
            en: "Google login is connected. Profile, templates and workout sessions are saved on the server database.",
            ru: "Google вход подключён. Профиль, шаблоны и тренировки сохраняются в серверной базе данных."
          })
        : t({
            en: "Google login is not connected. New progress stays only in this browser until you sign in.",
            ru: "Google вход не подключён. Новый прогресс остаётся только в этом браузере, пока ты не войдёшь."
          }),
      meta: serverSyncEnabled
        ? profile?.email ?? t({ en: "Google sync enabled", ru: "Google sync включён" })
        : t({ en: "Local-only mode", ru: "Только локальный режим" }),
      icon: <Server aria-hidden="true" size={22} />,
      tone: serverSyncEnabled ? "good" : "amber"
    },
    {
      title: t({ en: "Active workout", ru: "Активная тренировка" }),
      body: t({
        en: "An unfinished workout draft is kept in session storage so a tab refresh can recover it.",
        ru: "Незавершённая тренировка хранится в session storage, чтобы её можно было восстановить после обновления вкладки."
      }),
      icon: <History aria-hidden="true" size={22} />
    }
  ];

  const syncCards: DataCard[] = [
    {
      title: t({ en: "Synced with Google login", ru: "Синхронизируется при Google входе" }),
      body: t({
        en: "Profile settings, workout templates, sessions, report notes, heart rate, distance, pace, cadence, breathing and pain.",
        ru: "Настройки профиля, шаблоны, тренировки, заметки отчётов, пульс, дистанция, темп, каденс, дыхание и боль."
      }),
      icon: <Cloud aria-hidden="true" size={22} />,
      tone: "good"
    },
    {
      title: t({ en: "Browser preferences", ru: "Настройки браузера" }),
      body: t({
        en: "Language, theme, weekly plan completion and readiness checks are kept in this browser. They are included in JSON export, but are not server sync state.",
        ru: "Язык, тема, выполнение недельного плана и проверки готовности остаются в этом браузере. Они входят в JSON export, но не являются серверной синхронизацией."
      }),
      icon: <Settings aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Google account data", ru: "Данные Google аккаунта" }),
      body: t({
        en: "The app stores the Google account identifier, email and login session needed to keep server progress attached to your account.",
        ru: "Приложение хранит идентификатор Google аккаунта, email и login session, чтобы серверный прогресс был привязан к аккаунту."
      }),
      icon: <ShieldCheck aria-hidden="true" size={22} />
    }
  ];

  const deleteCards: DataCard[] = [
    {
      title: t({ en: "Delete local browser data", ru: "Удалить данные браузера" }),
      body: t({
        en: "Clears local sessions, local profile, workout templates, weekly plan choices and unfinished workout draft from this browser.",
        ru: "Очищает локальные тренировки, локальный профиль, шаблоны, выборы недельного плана и незавершённую тренировку в этом браузере."
      }),
      icon: <Smartphone aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Delete server progress", ru: "Удалить серверный прогресс" }),
      body: t({
        en: "When Google sync is connected, the delete button removes the server profile and its sessions, then clears browser progress.",
        ru: "Если Google sync подключён, кнопка удаления удаляет серверный профиль с тренировками, затем очищает прогресс браузера."
      }),
      icon: <Database aria-hidden="true" size={22} />,
      tone: serverSyncEnabled ? "danger" : "amber"
    }
  ];

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
      setStatus(
        t({
          en: `Exported ${sessionCount} sessions to JSON`,
          ru: `Экспортировано тренировок в JSON: ${sessionCount}`
        })
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t({ en: "Could not export data", ru: "Не удалось экспортировать данные" }));
    } finally {
      setIsExporting(false);
    }
  };

  const deleteData = async () => {
    const confirmed = window.confirm(
      serverSyncEnabled
        ? t({
            en: "Delete server progress for this Google account and clear browser progress? Export JSON first if you need a backup.",
            ru: "Удалить серверный прогресс этого Google аккаунта и очистить прогресс браузера? Сначала сделай JSON export, если нужен backup."
          })
        : t({
            en: "Delete browser progress on this device? Export JSON first if you need a backup.",
            ru: "Удалить прогресс браузера на этом устройстве? Сначала сделай JSON export, если нужен backup."
          })
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setStatus(t({ en: "Deleting data...", ru: "Удаление данных..." }));

    try {
      if (serverSyncEnabled) {
        await deleteProfile();
      }

      await clearBrowserProgressData();
      setWorkoutDraft(undefined);
      await loadInitialData();
      setBrowserSessionsCount(0);
      setStatus(t({ en: "Data deleted", ru: "Данные удалены" }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t({ en: "Could not delete data", ru: "Не удалось удалить данные" }));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="stack">
      <section className="hero-panel">
        <div className="eyebrow">{t({ en: "Data & Privacy", ru: "Данные и приватность" })}</div>
        <h1>{t({ en: "Your progress, storage and backup", ru: "Прогресс, хранение и backup" })}</h1>
        <p className="muted">
          {t({
            en: "This screen explains where app data lives, what Google sync changes, and how to export or delete progress.",
            ru: "Этот экран объясняет, где живут данные приложения, что меняет Google sync, и как экспортировать или удалить прогресс."
          })}
        </p>
      </section>

      {!serverSyncEnabled ? (
        <div className="warning-callout">
          <AlertTriangle aria-hidden="true" size={22} />
          <p>
            {t({
              en: "Without Google login, progress is only in this browser and can be lost if browser storage, cache, cookies or site data are cleared.",
              ru: "Без входа через Google прогресс находится только в этом браузере и может пропасть при очистке хранилища браузера, кеша, cookies или site data."
            })}
          </p>
        </div>
      ) : null}

      <section className="privacy-band" aria-labelledby="privacy-storage-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t({ en: "Storage", ru: "Хранение" })}</div>
            <h2 id="privacy-storage-title">{t({ en: "Where data is stored", ru: "Где хранятся данные" })}</h2>
          </div>
        </div>
        <DataCardGrid cards={storageCards} />
      </section>

      <section className="privacy-band" aria-labelledby="privacy-sync-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t({ en: "Sync", ru: "Синхронизация" })}</div>
            <h2 id="privacy-sync-title">{t({ en: "What syncs", ru: "Что синхронизируется" })}</h2>
          </div>
        </div>
        <DataCardGrid cards={syncCards} />
      </section>

      <section className="privacy-band" aria-labelledby="privacy-export-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t({ en: "Export", ru: "Экспорт" })}</div>
            <h2 id="privacy-export-title">{t({ en: "How to export data", ru: "Как экспортировать данные" })}</h2>
          </div>
          <p className="muted">
            {serverSyncEnabled
              ? t({
                  en: "Export pulls server profile, templates and sessions, then adds local browser preferences to one JSON file.",
                  ru: "Экспорт берёт серверный профиль, шаблоны и тренировки, затем добавляет локальные browser preferences в один JSON файл."
                })
              : t({
                  en: "Export creates a JSON backup from this browser. Keep it somewhere safe before clearing site data.",
                  ru: "Экспорт создаёт JSON backup из этого браузера. Сохрани его в безопасном месте перед очисткой site data."
                })}
          </p>
        </div>
        <button className="secondary-action" type="button" disabled={isExporting} onClick={() => void exportData()}>
          <Download aria-hidden="true" size={23} />
          {isExporting ? t({ en: "Exporting...", ru: "Экспорт..." }) : t({ en: "Export JSON", ru: "Экспорт JSON" })}
        </button>
      </section>

      <section className="privacy-band" aria-labelledby="privacy-delete-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t({ en: "Delete", ru: "Удаление" })}</div>
            <h2 id="privacy-delete-title">{t({ en: "How to delete data", ru: "Как удалить данные" })}</h2>
          </div>
        </div>
        <DataCardGrid cards={deleteCards} />
        <button className="secondary-action danger" type="button" disabled={isDeleting} onClick={() => void deleteData()}>
          <Trash2 aria-hidden="true" size={23} />
          {isDeleting ? t({ en: "Deleting...", ru: "Удаление..." }) : t({ en: "Delete progress", ru: "Удалить прогресс" })}
        </button>
      </section>

      <section className="privacy-band" aria-labelledby="privacy-policy-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{t({ en: "Policy", ru: "Политика" })}</div>
            <h2 id="privacy-policy-title">{t({ en: "Privacy policy", ru: "Политика приватности" })}</h2>
          </div>
          <p className="muted">
            {t({
              en: "The static privacy policy is available separately for legal wording.",
              ru: "Отдельная статическая политика приватности доступна для юридической формулировки."
            })}
          </p>
        </div>
        <div className="action-grid">
          <a className="secondary-action" href="/privacy.html">
            <FileJson aria-hidden="true" size={23} />
            {t({ en: "Open privacy policy", ru: "Открыть privacy policy" })}
          </a>
          <Link className="secondary-action" to="/settings">
            <Settings aria-hidden="true" size={23} />
            {t({ en: "Back to settings", ru: "Назад в настройки" })}
          </Link>
        </div>
      </section>

      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
