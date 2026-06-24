import type { BreathingLevel, PainType, WorkoutPhase } from "@run-walk-coach/shared";
import type { AppLanguage } from "./language.js";
import {
  breathingLabel as localizedBreathingLabel,
  formatDateTime as localizedFormatDateTime,
  painLabel as localizedPainLabel,
  phaseLabel as localizedPhaseLabel
} from "./language.js";

export function phaseLabel(phase: WorkoutPhase, language: AppLanguage = "en") {
  return localizedPhaseLabel(phase, language);
}

export function breathingLabel(value: BreathingLevel, language: AppLanguage = "en") {
  return localizedBreathingLabel(value, language);
}

export function painLabel(value: PainType, language: AppLanguage = "en") {
  return localizedPainLabel(value, language);
}

export function formatDateTime(value: string, language: AppLanguage = "en") {
  return localizedFormatDateTime(value, language);
}
