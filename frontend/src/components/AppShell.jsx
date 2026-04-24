import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { fetchHealth } from "../api/client";
import NavRail from "./NavRail";
import StatusBar from "./StatusBar";

export default function AppShell({ navItems, children }) {
  const { authEnabled, logout, user } = useAuth();
  const [health, setHealth] = useState({ ok: false, gdu: false, fd: false, fclones: false, authEnabled: false });

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth({ ok: false, gdu: false, fd: false, fclones: false, authEnabled: false }));
  }, []);

  return (
    <div className="app-shell">
      <NavRail items={navItems} authEnabled={authEnabled} user={user} onLogout={logout} />
      <div className="app-main">
        <main className="page-body">{children}</main>
        <StatusBar health={health} />
      </div>
    </div>
  );
}
