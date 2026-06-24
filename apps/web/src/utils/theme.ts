export type AppTheme = "light" | "dark";

const THEME_KEY = "runWalkCoach.theme";
const THEME_COLORS: Record<AppTheme, string> = {
  light: "#f7f9fb",
  dark: "#101114"
};

export function getStoredTheme(): AppTheme {
  if (typeof localStorage === "undefined") {
    return "light";
  }

  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function setStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme can still be applied for the current tab even if persistence is blocked.
  }

  applyTheme(theme);
}
