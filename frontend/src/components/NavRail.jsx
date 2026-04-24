import { useState } from "react";
import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import { classNames } from "../lib/format";
import { useI18n } from "../lib/i18n.jsx";
import { persistSettingsToServer, readThemeSetting, writeThemeSetting } from "../lib/settingsStore";
import { applyThemeMode, readAppliedThemeMode } from "../lib/theme";

export default function NavRail({ items, authEnabled, user, onLogout }) {
  const { t } = useI18n();
  const initials = (user?.username || "FA").slice(0, 2).toUpperCase();
  const [themeMode, setThemeMode] = useState(() => readThemeSetting());
  const [appliedTheme, setAppliedTheme] = useState(() => readAppliedThemeMode());

  function handleToggleTheme() {
    const currentApplied = appliedTheme === "dark" ? "dark" : "light";
    const nextTheme = currentApplied === "dark" ? "light" : "dark";
    writeThemeSetting(nextTheme);
    void persistSettingsToServer().catch(() => {});
    const resolved = applyThemeMode(nextTheme);
    setThemeMode(nextTheme);
    setAppliedTheme(resolved);
  }

  return (
    <aside className="nav-rail">
      <div className="nav-brand">
        <div className="nav-brand-mark">
          <Icon name="terminal" />
        </div>
        <span>FILE ANAER</span>
      </div>
      <nav className="nav-links">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => classNames("nav-link", isActive && "is-active")}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="nav-footer">
        {authEnabled ? (
          <div className="nav-user">
            <div className="avatar">{initials}</div>
            <span className="nav-user-name">{user?.username}</span>
            <button className="nav-link nav-link-button" type="button" onClick={onLogout}>
              <Icon name="logout" />
              <span>{t("auth.signOut")}</span>
            </button>
          </div>
        ) : null}
        <button className="nav-link nav-link-button" type="button" onClick={handleToggleTheme} title={themeMode === "system" ? t("settings.themeSystem") : (appliedTheme === "dark" ? t("settings.themeDark") : t("settings.themeLight"))}>
          <Icon name={appliedTheme === "dark" ? "light_mode" : "dark_mode"} />
          <span>{appliedTheme === "dark" ? t("settings.themeLight") : t("settings.themeDark")}</span>
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) => classNames("nav-link", "nav-link-button", isActive && "is-active")}
        >
          <Icon name="settings" />
          <span>{t("app.nav.settings")}</span>
        </NavLink>
      </div>
    </aside>
  );
}
