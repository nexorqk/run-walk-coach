import { ONBOARDING_COMPLETE_KEY } from "./storage-keys.js";

export function getOnboardingComplete() {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
  } catch {
    // The app can still continue in the current tab if storage is blocked.
  }
}
