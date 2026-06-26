import {
  ArrowUp,
  BarChart3,
  CalendarDays,
  HeartPulse,
  History,
  Settings,
  TimerReset
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { CoachPage } from "./pages/CoachPage.js";
import { DataPrivacyPage } from "./pages/DataPrivacyPage.js";
import { HistoryPage } from "./pages/HistoryPage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { OnboardingPage } from "./pages/OnboardingPage.js";
import { SessionReportPage } from "./pages/SessionReportPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { TodayPage } from "./pages/TodayPage.js";
import { WorkoutPage } from "./pages/WorkoutPage.js";
import { retryPendingSessions } from "./sync/sync-sessions.js";
import { Toaster } from "./components/Toaster.js";
import { useAppStore } from "./store/app-store.js";
import { useLanguage } from "./utils/language.js";
import { getOnboardingComplete, setOnboardingComplete } from "./utils/onboarding.js";

function scrollDocumentToTop(behavior: ScrollBehavior = "auto") {
  window.scrollTo({ top: 0, left: 0, behavior });

  if (behavior === "auto") {
    document.scrollingElement?.scrollTo({ top: 0, left: 0 });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

function BottomNav() {
  const { t } = useLanguage();
  const scrollToTop = useCallback(() => {
    scrollDocumentToTop("smooth");
  }, []);

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/today" className="nav-item" onClick={scrollToTop}>
        <CalendarDays aria-hidden="true" size={23} />
        <span>{t({ en: "Today", ru: "Сегодня" })}</span>
      </NavLink>
      <NavLink to="/coach" className="nav-item" onClick={scrollToTop}>
        <HeartPulse aria-hidden="true" size={23} />
        <span>{t({ en: "Coach", ru: "Тренер" })}</span>
      </NavLink>
      <NavLink to="/history" className="nav-item" onClick={scrollToTop}>
        <History aria-hidden="true" size={23} />
        <span>{t({ en: "History", ru: "История" })}</span>
      </NavLink>
      <NavLink to="/analytics" className="nav-item" onClick={scrollToTop}>
        <BarChart3 aria-hidden="true" size={23} />
        <span>{t({ en: "Stats", ru: "Статы" })}</span>
      </NavLink>
      <NavLink to="/settings" className="nav-item" onClick={scrollToTop}>
        <Settings aria-hidden="true" size={23} />
        <span>{t({ en: "Settings", ru: "Настройки" })}</span>
      </NavLink>
    </nav>
  );
}

function ScrollToTopButton() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const label = t({ en: "Scroll to top", ru: "Наверх" });

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > 360);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  const scrollToTop = useCallback(() => {
    scrollDocumentToTop("smooth");
  }, []);

  return (
    <button
      className={isVisible ? "scroll-top-button visible" : "scroll-top-button"}
      type="button"
      aria-label={label}
      title={label}
      onClick={scrollToTop}
    >
      <ArrowUp aria-hidden="true" size={24} />
    </button>
  );
}

export function App() {
  const location = useLocation();
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const { t } = useLanguage();
  const isWorkout = location.pathname.startsWith("/workout");
  const isOnboarding = location.pathname.startsWith("/onboarding");
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [onboardingComplete, setOnboardingCompleteState] = useState(() => getOnboardingComplete());
  const isLanding = location.pathname === "/";

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) {
      return;
    }

    const initialScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = initialScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    scrollDocumentToTop();

    const frame = window.requestAnimationFrame(() => {
      scrollDocumentToTop();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isLanding) {
      setHasLoadedInitialData(true);
      return;
    }

    let isMounted = true;

    void loadInitialData()
      .then(() => retryPendingSessions(useAppStore.getState().serverSyncEnabled))
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setHasLoadedInitialData(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadInitialData, isLanding]);

  const completeOnboarding = () => {
    setOnboardingComplete();
    setOnboardingCompleteState(true);
  };

  const guarded = (element: ReactElement) => (
    onboardingComplete ? element : <Navigate to="/onboarding" replace />
  );

  if (isWorkout) {
    return (
      <Routes>
        <Route path="/workout/:templateId" element={guarded(<WorkoutPage />)} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    );
  }

  if (isLanding) {
    return hasLoadedInitialData ? <LandingPage /> : (
      <div className="app-shell">
        <section className="empty-state">
          <div className="loader" />
          <p>{t({ en: "Loading...", ru: "Загрузка..." })}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand" aria-label="RunWalk Coach Today">
          <img src="/icon.svg" alt="" width="38" height="38" />
          <span>RunWalk Coach</span>
        </NavLink>
        <TimerReset aria-hidden="true" size={26} className="header-mark" />
      </header>

      <main className="page">
        {hasLoadedInitialData ? (
          <Routes>
            <Route path="/" element={onboardingComplete ? <Navigate to="/today" replace /> : <LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage onComplete={completeOnboarding} />} />
            <Route path="/today" element={guarded(<TodayPage />)} />
            <Route path="/coach" element={guarded(<CoachPage />)} />
            <Route path="/data-privacy" element={guarded(<DataPrivacyPage />)} />
            <Route path="/session-report" element={guarded(<SessionReportPage />)} />
            <Route path="/history" element={guarded(<HistoryPage />)} />
            <Route path="/settings" element={guarded(<SettingsPage />)} />
            <Route path="/analytics" element={guarded(<AnalyticsPage />)} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        ) : (
          <section className="empty-state">
            <div className="loader" />
            <p>{t({ en: "Loading...", ru: "Загрузка..." })}</p>
          </section>
        )}
      </main>

      {!isOnboarding && !isLanding ? <BottomNav /> : null}
      {!isWorkout ? <ScrollToTopButton /> : null}
      <Toaster />
    </div>
  );
}
