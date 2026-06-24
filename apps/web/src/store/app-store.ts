import {
  DEFAULT_USER_PROFILE,
  DEFAULT_WORKOUT_TEMPLATES,
  type ProgressionResponse,
  type UpdateUserProfile,
  type UpdateWorkoutTemplate,
  type UserProfile,
  type WorkoutTemplate
} from "@run-walk-coach/shared";
import { create } from "zustand";
import { getNextProgression, getProfile, getWorkoutTemplates } from "../api/client.js";
import { db, type LocalWorkoutSession } from "../db/local-db.js";

export type WorkoutDraft = {
  template: WorkoutTemplate;
  date: string;
  completed: boolean;
  elapsedMs: number;
  totalDurationSec: number;
  totalRunSec: number;
  totalWalkSec: number;
};

type AppState = {
  profile?: UserProfile;
  templates: WorkoutTemplate[];
  recommendation?: ProgressionResponse;
  activeWorkoutTemplate?: WorkoutTemplate;
  workoutDraft?: WorkoutDraft;
  isLoading: boolean;
  serverSyncEnabled: boolean;
  loadInitialData: () => Promise<void>;
  refreshRecommendation: () => Promise<void>;
  updateLocalProfile: (payload: UpdateUserProfile) => void;
  updateLocalWorkoutTemplate: (id: string, payload: UpdateWorkoutTemplate) => Promise<void>;
  setActiveWorkoutTemplate: (template: WorkoutTemplate) => void;
  setWorkoutDraft: (draft?: WorkoutDraft) => void;
};

const LOCAL_PROFILE_KEY = "runWalkCoach.localProfile";
const LOCAL_TEMPLATES_KEY = "runWalkCoach.localTemplates";

function fallbackTemplate(level = 1): WorkoutTemplate {
  const base = DEFAULT_WORKOUT_TEMPLATES.find((template) => template.level === level) ?? DEFAULT_WORKOUT_TEMPLATES[0];

  return {
    id: `local-level-${base.level}`,
    userId: null,
    name: base.name,
    level: base.level,
    type: base.type,
    warmupSec: base.warmupSec,
    runSec: base.runSec,
    walkSec: base.walkSec,
    repeats: base.repeats,
    cooldownSec: base.cooldownSec,
    isDefault: true,
    createdAt: new Date(0).toISOString()
  };
}

function templateName(level: number, type: string, runSec: number, walkSec: number) {
  const formatSeconds = (seconds: number) => {
    if (seconds >= 60 && seconds % 60 === 0) {
      return `${seconds / 60} min`;
    }

    return `${seconds} sec`;
  };

  if (type === "WALK") {
    return `Level ${level} - ${formatSeconds(walkSec || runSec)} walk`;
  }

  if (type === "EASY_RUN") {
    return `Level ${level} - ${formatSeconds(runSec)} easy run`;
  }

  if (walkSec === 0) {
    return `Level ${level} - ${formatSeconds(runSec)} run`;
  }

  return `Level ${level} - ${formatSeconds(runSec)} run / ${formatSeconds(walkSec)} walk`;
}

function fallbackTemplates(): WorkoutTemplate[] {
  return DEFAULT_WORKOUT_TEMPLATES.map((template) => fallbackTemplate(template.level));
}

function createLocalProfile(): UserProfile {
  const now = new Date().toISOString();

  return {
    id: "local-user",
    email: null,
    ...DEFAULT_USER_PROFILE,
    googleLinkedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalProfile() {
  return readJson<UserProfile>(LOCAL_PROFILE_KEY) ?? createLocalProfile();
}

function saveLocalProfile(profile: UserProfile) {
  writeJson(LOCAL_PROFILE_KEY, profile);
}

function getLocalTemplates() {
  return readJson<WorkoutTemplate[]>(LOCAL_TEMPLATES_KEY) ?? fallbackTemplates();
}

function saveLocalTemplates(templates: WorkoutTemplate[]) {
  writeJson(LOCAL_TEMPLATES_KEY, templates);
}

function isSuccessfulSession(session: LocalWorkoutSession) {
  return (
    session.pain === "NONE" &&
    session.difficulty <= 6 &&
    ["EASY", "MEDIUM", "HARD"].includes(session.breathing) &&
    (session.maxHr === null || session.maxHr === undefined || session.maxHr < 160)
  );
}

function preferredTemplate(templates: WorkoutTemplate[], level: number) {
  const normalizedLevel = Math.min(10, Math.max(1, level));
  return templates.find((template) => template.level === normalizedLevel) ?? fallbackTemplate(normalizedLevel);
}

async function getLocalRecommendation(templates: WorkoutTemplate[]): Promise<ProgressionResponse> {
  const recentSessions = await db.sessions.orderBy("date").reverse().limit(20).toArray();

  if (recentSessions.length === 0) {
    return {
      action: "repeat",
      template: preferredTemplate(templates, 1),
      reason: "Start with Level 1 and keep the effort easy."
    };
  }

  const latest = recentSessions[0];
  const currentLevel = latest.templateLevel ?? 1;

  if (latest.pain !== "NONE") {
    const nextLevel = currentLevel > 1 ? currentLevel - 1 : currentLevel;
    return {
      action: currentLevel > 1 ? "regress" : "repeat",
      template: preferredTemplate(templates, nextLevel),
      reason: "Pain was reported in the latest session, so reduce or repeat the load."
    };
  }

  if (latest.difficulty >= 8) {
    return {
      action: "repeat",
      template: preferredTemplate(templates, currentLevel),
      reason: "The latest session was too hard, so repeat this level."
    };
  }

  if (latest.breathing === "VERY_HARD") {
    return {
      action: "repeat",
      template: preferredTemplate(templates, currentLevel),
      reason: "Breathing load was too high, so repeat this level."
    };
  }

  if (latest.maxHr !== null && latest.maxHr !== undefined && latest.maxHr >= 170) {
    return {
      action: "repeat",
      template: preferredTemplate(templates, currentLevel),
      reason: "Heart rate was too high, so repeat this level."
    };
  }

  const firstTwo = recentSessions.slice(0, 2);
  const hasTwoSuccessfulAtCurrentLevel =
    firstTwo.length === 2 &&
    firstTwo.every(
      (session) => (session.templateLevel ?? 1) === currentLevel && isSuccessfulSession(session)
    );

  if (hasTwoSuccessfulAtCurrentLevel) {
    if (currentLevel >= 10) {
      return {
        action: "repeat",
        template: preferredTemplate(templates, 10),
        reason: "You are already at Level 10; keep the easy run controlled."
      };
    }

    return {
      action: "progress",
      template: preferredTemplate(templates, currentLevel + 1),
      reason: "Two successful sessions in a row at the current level are complete."
    };
  }

  return {
    action: "repeat",
    template: preferredTemplate(templates, currentLevel),
    reason: "Repeat this level until two controlled sessions are completed in a row."
  };
}

function getStoredDraft(): WorkoutDraft | undefined {
  try {
    const raw = sessionStorage.getItem("workoutDraft");
    return raw ? (JSON.parse(raw) as WorkoutDraft) : undefined;
  } catch {
    return undefined;
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  templates: [fallbackTemplate()],
  workoutDraft: getStoredDraft(),
  isLoading: false,
  serverSyncEnabled: false,

  loadInitialData: async () => {
    set({ isLoading: true });

    try {
      const profile = await getProfile();
      if (!profile.googleLinkedAt) {
        throw new Error("Google account required for server sync");
      }

      const [templates, recommendation] = await Promise.all([
        getWorkoutTemplates(),
        getNextProgression()
      ]);

      set({ profile, templates, recommendation, isLoading: false, serverSyncEnabled: true });
    } catch {
      const profile = getLocalProfile();
      const templates = getLocalTemplates();
      const recommendation = await getLocalRecommendation(templates);

      set({
        profile,
        templates,
        recommendation,
        isLoading: false,
        serverSyncEnabled: false
      });
    }
  },

  refreshRecommendation: async () => {
    if (get().serverSyncEnabled) {
      try {
        set({ recommendation: await getNextProgression() });
        return;
      } catch {
        set({ serverSyncEnabled: false });
      }
    }

    const templates = getLocalTemplates();
    set({ recommendation: await getLocalRecommendation(templates), templates });
  },

  updateLocalProfile: (payload) => {
    const profile = {
      ...(get().profile ?? getLocalProfile()),
      ...payload,
      googleLinkedAt: null,
      updatedAt: new Date().toISOString()
    };

    saveLocalProfile(profile);
    set({ profile, serverSyncEnabled: false });
  },

  updateLocalWorkoutTemplate: async (id, payload) => {
    const templates = getLocalTemplates();
    const templateIndex = templates.findIndex((template) => template.id === id);

    if (templateIndex === -1) {
      return;
    }

    const current = templates[templateIndex];
    const next = {
      ...current,
      ...payload
    };
    const namedNext = {
      ...next,
      name: templateName(next.level, next.type, next.runSec, next.walkSec)
    };
    const updatedTemplates = [...templates];
    updatedTemplates[templateIndex] = namedNext;
    saveLocalTemplates(updatedTemplates);
    set({
      templates: updatedTemplates,
      recommendation: await getLocalRecommendation(updatedTemplates),
      serverSyncEnabled: false
    });
  },

  setActiveWorkoutTemplate: (template) => set({ activeWorkoutTemplate: template }),

  setWorkoutDraft: (draft) => {
    if (draft) {
      sessionStorage.setItem("workoutDraft", JSON.stringify(draft));
    } else {
      sessionStorage.removeItem("workoutDraft");
    }

    set({ workoutDraft: draft });
  }
}));
