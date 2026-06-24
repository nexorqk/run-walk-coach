export type AppTheme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<AppTheme, "system">;

const THEME_KEY = "runWalkCoach.theme";
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f7f9fb",
  dark: "#101114"
};

function isAppTheme(value: string | null): value is AppTheme {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(theme: AppTheme): ResolvedTheme {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredTheme(): AppTheme {
  if (typeof localStorage === "undefined") {
    return "light";
  }

  try {
    const theme = localStorage.getItem(THEME_KEY);
    return isAppTheme(theme) ? theme : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: AppTheme) {
  const resolvedTheme = resolveTheme(theme);

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = resolvedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolvedTheme]);
}

export function setStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme can still be applied for the current tab even if persistence is blocked.
  }

  applyTheme(theme);
}

export function watchSystemTheme() {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const applySystemTheme = () => {
    if (getStoredTheme() === "system") {
      applyTheme("system");
    }
  };

  systemTheme.addEventListener("change", applySystemTheme);

  return () => systemTheme.removeEventListener("change", applySystemTheme);
}
