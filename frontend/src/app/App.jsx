import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AppShell from "../components/AppShell";
import LoadingState from "../components/LoadingState";
import { useI18n } from "../lib/i18n.jsx";
import { releaseAllRuntimeMemoryOnUnload } from "../lib/runtimeMemory";
import { hydrateSettingsFromServer, readThemeSetting } from "../lib/settingsStore";
import { applyThemeMode, watchSystemThemeChange } from "../lib/theme";
import AnalysisPage from "../pages/AnalysisPage.jsx";
import DuplicatesPage from "../pages/DuplicatesPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import SearchPage from "../pages/SearchPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import SetupPage from "../pages/SetupPage.jsx";

export default function App() {
  const { t, setLocale } = useI18n();
  const { authEnabled, setupRequired, isAuthenticated, loading } = useAuth();
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const themeMode = readThemeSetting();
    applyThemeMode(themeMode);
    return watchSystemThemeChange(() => {
      if (readThemeSetting() === "system") {
        applyThemeMode("system");
      }
    });
  }, []);

  useEffect(() => {
    function handleBeforeUnload() {
      releaseAllRuntimeMemoryOnUnload();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (loading) {
      return undefined;
    }
    if (setupRequired || (authEnabled && !isAuthenticated)) {
      setSettingsReady(false);
      return undefined;
    }

    let cancelled = false;
    hydrateSettingsFromServer()
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setLocale(settings.locale);
        applyThemeMode(settings.theme);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSettingsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authEnabled, isAuthenticated, loading, setLocale, setupRequired]);

  const navItems = [
    { to: "/search", label: t("app.nav.search"), icon: "search" },
    { to: "/analysis", label: t("app.nav.analysis"), icon: "analytics" },
    { to: "/duplicates", label: t("app.nav.duplicates"), icon: "content_copy" }
  ];

  if (loading) {
    return <LoadingState title={t("app.loadingPage")} />;
  }

  if (!setupRequired && (!authEnabled || isAuthenticated) && !settingsReady) {
    return <LoadingState title={t("app.loadingPage")} />;
  }

  if (setupRequired) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell navItems={navItems}>
      <Routes>
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="/login" element={<Navigate to="/search" replace />} />
        <Route path="/setup" element={<Navigate to="/search" replace />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/duplicates" element={<DuplicatesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </AppShell>
  );
}
