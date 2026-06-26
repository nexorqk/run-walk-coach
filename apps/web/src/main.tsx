import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { reportClientError } from "./api/client.js";
import { applyLanguage, getStoredLanguage } from "./utils/language.js";
import { isIosBrowserMode, isIosDevice, isStandaloneDisplayMode } from "./utils/platform.js";
import { applyTheme, getStoredTheme, watchSystemTheme } from "./utils/theme.js";
import "./app.css";

applyLanguage(getStoredLanguage());
applyTheme(getStoredTheme());
watchSystemTheme();
document.documentElement.dataset.platform = isIosDevice() ? "ios" : "default";
document.documentElement.dataset.displayMode = isStandaloneDisplayMode() ? "standalone" : "browser";

function errorMessageFromUnknown(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function errorStackFromUnknown(value: unknown) {
  return value instanceof Error ? value.stack : undefined;
}

function installClientErrorReporting() {
  window.addEventListener("error", (event) => {
    void reportClientError({
      message: event.message || errorMessageFromUnknown(event.error),
      stack: errorStackFromUnknown(event.error),
      source: event.filename,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      language: document.documentElement.lang
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    void reportClientError({
      message: errorMessageFromUnknown(event.reason),
      stack: errorStackFromUnknown(event.reason),
      source: "unhandledrejection",
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      language: document.documentElement.lang
    });
  });
}

installClientErrorReporting();

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
