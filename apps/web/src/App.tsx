import {
  BarChart3,
  CalendarDays,
  History,
  Settings,
  TimerReset
} from "lucide-react";
import { useEffect } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { HistoryPage } from "./pages/HistoryPage.js";
import { SessionReportPage } from "./pages/SessionReportPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { TodayPage } from "./pages/TodayPage.js";
import { WorkoutPage } from "./pages/WorkoutPage.js";
import { retryPendingSessions } from "./sync/sync-sessions.js";
import { useAppStore } from "./store/app-store.js";

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/today" className="nav-item">
        <CalendarDays aria-hidden="true" size={23} />
        <span>Today</span>
      </NavLink>
      <NavLink to="/history" className="nav-item">
        <History aria-hidden="true" size={23} />
        <span>History</span>
      </NavLink>
      <NavLink to="/analytics" className="nav-item">
        <BarChart3 aria-hidden="true" size={23} />
        <span>Stats</span>
      </NavLink>
      <NavLink to="/settings" className="nav-item">
        <Settings aria-hidden="true" size={23} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}

export function App() {
  const location = useLocation();
  const loadInitialData = useAppStore((state) => state.loadInitialData);
  const isWorkout = location.pathname.startsWith("/workout");

  useEffect(() => {
    void retryPendingSessions();
    void loadInitialData();
  }, [loadInitialData]);

  if (isWorkout) {
    return (
      <Routes>
        <Route path="/workout/:templateId" element={<WorkoutPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/today" className="brand" aria-label="RunWalk Coach Today">
          <img src="/icon.svg" alt="" width="38" height="38" />
          <span>RunWalk Coach</span>
        </NavLink>
        <TimerReset aria-hidden="true" size={26} className="header-mark" />
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/session-report" element={<SessionReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}
