import {
  AnalyticsSummarySchema,
  AuthProvidersSchema,
  ProgressionResponseSchema,
  type AnalyticsSummary,
  type AuthProviders,
  type CreateWorkoutSession,
  type ProgressionResponse,
  type UpdateUserProfile,
  type UpdateWorkoutTemplate,
  type UserProfile,
  type WorkoutSession,
  type WorkoutTemplate,
  UserProfileSchema,
  WorkoutSessionSchema,
  WorkoutTemplateSchema
} from "@run-walk-coach/shared";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function googleLoginUrl() {
  return `${API_BASE}/auth/google/start`;
}

export type ClientErrorReport = {
  message: string;
  stack?: string;
  source?: string;
  path?: string;
  userAgent?: string;
  language?: string;
};

export function reportClientError(payload: ClientErrorReport) {
  return fetch(`${API_BASE}/client-errors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload)
  }).catch(() => undefined);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getProfile(): Promise<UserProfile> {
  return UserProfileSchema.parse(await apiFetch<unknown>("/profile"));
}

export async function updateProfile(payload: UpdateUserProfile): Promise<UserProfile> {
  return UserProfileSchema.parse(
    await apiFetch<unknown>("/profile", {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
  );
}

export async function deleteProfile(): Promise<void> {
  await apiFetch<void>("/profile", {
    method: "DELETE"
  });
}

export async function getAuthProviders(): Promise<AuthProviders> {
  return AuthProvidersSchema.parse(await apiFetch<unknown>("/auth/providers"));
}

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return z.array(WorkoutTemplateSchema).parse(await apiFetch<unknown>("/workout-templates"));
}

export async function updateWorkoutTemplate(
  id: string,
  payload: UpdateWorkoutTemplate
): Promise<WorkoutTemplate> {
  return WorkoutTemplateSchema.parse(
    await apiFetch<unknown>(`/workout-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
  );
}

export async function getNextProgression(): Promise<ProgressionResponse> {
  return ProgressionResponseSchema.parse(await apiFetch<unknown>("/progression/next"));
}

export async function getSessions(): Promise<WorkoutSession[]> {
  return z.array(WorkoutSessionSchema).parse(await apiFetch<unknown>("/sessions"));
}

export async function createSession(payload: CreateWorkoutSession): Promise<WorkoutSession> {
  return WorkoutSessionSchema.parse(
    await apiFetch<unknown>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return AnalyticsSummarySchema.parse(await apiFetch<unknown>("/analytics/summary"));
}
