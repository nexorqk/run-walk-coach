(() => {
  try {
    const storedLanguage = localStorage.getItem("runWalkCoach.language");
    const language =
      storedLanguage === "en" || storedLanguage === "ru"
        ? storedLanguage
        : navigator.language.toLowerCase().startsWith("ru")
          ? "ru"
          : "en";
    const storedTheme = localStorage.getItem("runWalkCoach.theme");
    const preference =
      storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
        ? storedTheme
        : "light";
    const theme =
      preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : preference === "dark"
          ? "dark"
          : "light";

    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101114" : "#f7f9fb");
  } catch {
    document.documentElement.lang = "en";
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
