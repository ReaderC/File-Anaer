import { useI18n } from "../lib/i18n.jsx";

const APP_VERSION = "0.1.1";

export default function StatusBar({ health }) {
  const { t } = useI18n();
  return (
    <footer className="status-bar">
      <div className="status-cluster">
        <span className="status-dot ok" />
        <span>{t("status.api")}: {health.ok ? t("status.ready") : t("status.offline")}</span>
      </div>
      <div className="status-cluster">
        <span className={`status-dot ${health.gdu ? "ok" : "warn"}`} />
        <span>{t("status.gdu")}: {health.gdu ? t("status.found") : t("status.missing")}</span>
      </div>
      <div className="status-cluster">
        <span className={`status-dot ${health.fd ? "ok" : "warn"}`} />
        <span>{t("status.fd")}: {health.fd ? t("status.found") : t("status.missing")}</span>
      </div>
      <div className="status-cluster">
        <span className={`status-dot ${health.fclones ? "ok" : "warn"}`} />
        <span>{t("status.fclones")}: {health.fclones ? t("status.found") : t("status.missing")}</span>
      </div>
      <div className="status-cluster status-version">
        <span>Version {APP_VERSION}</span>
      </div>
    </footer>
  );
}
