import {
  BarChart3,
  CalendarDays,
  HeartPulse,
  History,
  Settings,
  TimerReset
} from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { CoachPage } from "./pages/CoachPage.js";
import { HistoryPage } from "./pages/HistoryPage.js";
import { OnboardingPage } from "./pages/OnboardingPage.js";
import { SessionReportPage } from "./pages/SessionReportPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { TodayPage } from "./pages/TodayPage.js";
import { WorkoutPage } from "./pages/WorkoutPage.js";
import { retryPendingSessions } from "./sync/sync-sessions.js";
import { useAppStore } from "./store/app-store.js";
import { useLanguage } from "./utils/language.js";
import { getOnboardingComplete, setOnboardingComplete } from "./utils/onboarding.js";

function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/today" className="nav-item">
        <CalendarDays aria-hidden="true" size={23} />
        <span>{t({ en: "Today", ru: "Сегодня" })}</span>
      </NavLink>
      <NavLink to="/coach" className="nav-item">
        <HeartPulse aria-hidden="true" size={23} />
        <span>{t({ en: "Coach", ru: "Тренер" })}</span>
      </NavLink>
      <NavLink to="/history" className="nav-item">
        <History aria-hidden="true" size={23} />
        <span>{t({ en: "History", ru: "История" })}</span>
      </NavLink>
      <NavLink to="/analytics" className="nav-item">
        <BarChart3 aria-hidden="true" size={23} />
        <span>{t({ en: "Stats", ru: "Статы" })}</span>
      </NavLink>
      <NavLink to="/settings" className="nav-item">
        <Settings aria-hidden="true" size={23} />
        <span>{t({ en: "Settings", ru: "Настройки" })}</span>
      </NavLink>
    </nav>
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

  useEffect(() => {
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
  }, [loadInitialData]);

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to={onboardingComplete ? "/today" : "/onboarding"} className="brand" aria-label="RunWalk Coach Today">
          <img src="/icon.svg" alt="" width="38" height="38" />
          <span>RunWalk Coach</span>
        </NavLink>
        <TimerReset aria-hidden="true" size={26} className="header-mark" />
      </header>

      <main className="page">
        {hasLoadedInitialData ? (
          <Routes>
            <Route path="/" element={<Navigate to={onboardingComplete ? "/today" : "/onboarding"} replace />} />
            <Route path="/onboarding" element={<OnboardingPage onComplete={completeOnboarding} />} />
            <Route path="/today" element={guarded(<TodayPage />)} />
            <Route path="/coach" element={guarded(<CoachPage />)} />
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

      {!isOnboarding ? <BottomNav /> : null}
    </div>
  );
}
