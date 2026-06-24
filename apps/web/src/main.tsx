import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { applyLanguage, getStoredLanguage } from "./utils/language.js";
import { isIosBrowserMode, isIosDevice, isStandaloneDisplayMode } from "./utils/platform.js";
import { applyTheme, getStoredTheme, watchSystemTheme } from "./utils/theme.js";
import "./styles.css";

applyLanguage(getStoredLanguage());
applyTheme(getStoredTheme());
watchSystemTheme();
document.documentElement.dataset.platform = isIosDevice() ? "ios" : "default";
document.documentElement.dataset.displayMode = isStandaloneDisplayMode() ? "standalone" : "browser";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

function registerServiceWorker() {
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;

        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    })
    .catch(() => undefined);
}

function disableServiceWorkerForIosBrowser() {
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.unregister())
    .catch(() => undefined);
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    if (isIosBrowserMode()) {
      disableServiceWorkerForIosBrowser();
      return;
    }

    registerServiceWorker();
  });
}
