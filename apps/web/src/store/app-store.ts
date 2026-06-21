import {
  DEFAULT_USER_PROFILE,
  DEFAULT_WORKOUT_TEMPLATES,
  type ProgressionResponse,
  type UserProfile,
  type WorkoutTemplate
} from "@run-walk-coach/shared";
import { create } from "zustand";
import { getNextProgression, getProfile, getWorkoutTemplates } from "../api/client.js";

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
  loadInitialData: () => Promise<void>;
  refreshRecommendation: () => Promise<void>;
  setActiveWorkoutTemplate: (template: WorkoutTemplate) => void;
  setWorkoutDraft: (draft?: WorkoutDraft) => void;
};

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

  loadInitialData: async () => {
    set({ isLoading: true });

    const fallbackProfile: UserProfile = {
      id: "local-user",
      email: "runner@example.com",
      ...DEFAULT_USER_PROFILE,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };

    try {
      const [profile, templates, recommendation] = await Promise.all([
        getProfile(),
        getWorkoutTemplates(),
        getNextProgression()
      ]);

      set({ profile, templates, recommendation, isLoading: false });
    } catch {
      const template = fallbackTemplate();
      set({
        profile: fallbackProfile,
        templates: [template],
        recommendation: {
          action: "repeat",
          template,
          reason: "Offline mode: using the Level 1 default workout."
        },
        isLoading: false
      });
    }
  },

  refreshRecommendation: async () => {
    try {
      set({ recommendation: await getNextProgression() });
    } catch {
      const current = get().recommendation;
      if (!current) {
        const template = fallbackTemplate();
        set({
          recommendation: {
            action: "repeat",
            template,
            reason: "Offline mode: using the Level 1 default workout."
          }
        });
      }
    }
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
