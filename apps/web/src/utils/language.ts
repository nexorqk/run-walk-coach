import { useCallback, useEffect, useState } from "react";
import type { BreathingLevel, PainType, ProgressionAction, WorkoutPhase } from "@run-walk-coach/shared";
import type { SyncStatus } from "../db/local-db.js";

export type AppLanguage = "en" | "ru";

type Copy = Record<AppLanguage, string>;

const LANGUAGE_KEY = "runWalkCoach.language";
const LANGUAGE_EVENT = "runWalkCoach:language";

function defaultLanguage(): AppLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "ru";
}

export function getStoredLanguage(): AppLanguage {
  if (typeof localStorage === "undefined") {
    return defaultLanguage();
  }

  try {
    const language = localStorage.getItem(LANGUAGE_KEY);
    return isAppLanguage(language) ? language : defaultLanguage();
  } catch {
    return defaultLanguage();
  }
}

export function applyLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
}

export function setStoredLanguage(language: AppLanguage) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Language can still be applied for the current tab even if persistence is blocked.
  }

  applyLanguage(language);
  window.dispatchEvent(new CustomEvent<AppLanguage>(LANGUAGE_EVENT, { detail: language }));
}

export function text(language: AppLanguage, copy: Copy) {
  return copy[language];
}

export function useLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>(() => getStoredLanguage());

  useEffect(() => {
    const onLanguageChange = (event: Event) => {
      setLanguageState((event as CustomEvent<AppLanguage>).detail ?? getStoredLanguage());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY) {
        setLanguageState(getStoredLanguage());
      }
    };

    window.addEventListener(LANGUAGE_EVENT, onLanguageChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(LANGUAGE_EVENT, onLanguageChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    setStoredLanguage(nextLanguage);
  }, []);

  return {
    language,
    setLanguage,
    t: useCallback((copy: Copy) => text(language, copy), [language])
  };
}

export function phaseLabel(phase: WorkoutPhase, language: AppLanguage) {
  const labels: Record<WorkoutPhase, Copy> = {
    WARMUP: { en: "WARMUP", ru: "РАЗМИНКА" },
    RUN: { en: "RUN", ru: "БЕГ" },
    WALK: { en: "WALK", ru: "ШАГ" },
    COOLDOWN: { en: "COOLDOWN", ru: "ЗАМИНКА" },
    DONE: { en: "DONE", ru: "ГОТОВО" }
  };

  return text(language, labels[phase]);
}

export function breathingLabel(value: BreathingLevel, language: AppLanguage) {
  const labels: Record<BreathingLevel, Copy> = {
    EASY: { en: "Easy", ru: "Легко" },
    MEDIUM: { en: "Medium", ru: "Средне" },
    HARD: { en: "Hard", ru: "Тяжело" },
    VERY_HARD: { en: "Very hard", ru: "Очень тяжело" }
  };

  return text(language, labels[value]);
}

export function painLabel(value: PainType, language: AppLanguage) {
  const labels: Record<PainType, Copy> = {
    NONE: { en: "None", ru: "Нет" },
    SHIN: { en: "Shin", ru: "Голень" },
    KNEE: { en: "Knee", ru: "Колено" },
    ACHILLES: { en: "Achilles", ru: "Ахилл" },
    FOOT: { en: "Foot", ru: "Стопа" },
    HIP: { en: "Hip", ru: "Таз/бедро" },
    BACK: { en: "Back", ru: "Спина" },
    OTHER: { en: "Other", ru: "Другое" }
  };

  return text(language, labels[value]);
}

export function progressionActionLabel(action: ProgressionAction | undefined, language: AppLanguage) {
  if (!action) {
    return text(language, { en: "repeat", ru: "повтор" });
  }

  const labels: Record<ProgressionAction, Copy> = {
    progress: { en: "progress", ru: "прогресс" },
    repeat: { en: "repeat", ru: "повтор" },
    regress: { en: "regress", ru: "снизить" }
  };

  return text(language, labels[action]);
}

export function syncStatusLabel(status: SyncStatus, language: AppLanguage) {
  const labels: Record<SyncStatus, Copy> = {
    local: { en: "local", ru: "локально" },
    pending: { en: "pending", ru: "ожидает" },
    synced: { en: "synced", ru: "синхр." },
    failed: { en: "failed", ru: "ошибка" }
  };

  return text(language, labels[status]);
}

export function formatDateTime(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function localizeTemplateName(name: string | undefined, language: AppLanguage) {
  if (!name) {
    return text(language, { en: "Workout", ru: "Тренировка" });
  }

  if (language === "en") {
    return name;
  }

  return name
    .replace(/^Level /, "Уровень ")
    .replace("easy run", "лёгкий бег")
    .replace("run /", "бег /")
    .replace(" run", " бег")
    .replace("walk", "шаг")
    .replaceAll(" sec", " сек")
    .replaceAll(" min", " мин");
}

export function localizeProgressionReason(reason: string | undefined, language: AppLanguage) {
  if (!reason || language === "en") {
    return reason;
  }

  const reasons: Record<string, string> = {
    "Start with Level 1 and keep the effort easy.": "Начни с уровня 1 и держи усилие лёгким.",
    "Pain was reported in the latest session, so reduce or repeat the load.":
      "В последней тренировке была боль, поэтому снизь или повтори нагрузку.",
    "The latest session was too hard, so repeat this level.":
      "Последняя тренировка была слишком тяжёлой, повтори этот уровень.",
    "Breathing load was too high, so repeat this level.":
      "Дыхательная нагрузка была слишком высокой, повтори этот уровень.",
    "Heart rate was too high, so repeat this level.":
      "Пульс был слишком высоким, повтори этот уровень.",
    "You are already at Level 10; keep the easy run controlled.":
      "Ты уже на уровне 10; держи лёгкий бег под контролем.",
    "Two successful sessions in a row at the current level are complete.":
      "Две успешные тренировки подряд на текущем уровне выполнены.",
    "Repeat this level until two controlled sessions are completed in a row.":
      "Повторяй этот уровень, пока не будут выполнены две контролируемые тренировки подряд."
  };

  return reasons[reason] ?? reason;
}
