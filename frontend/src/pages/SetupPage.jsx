import { useState } from "react";
import { Navigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useI18n } from "../lib/i18n.jsx";

export default function SetupPage() {
  const { setupRequired, isAuthenticated, setup } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!setupRequired) {
    return <Navigate to={isAuthenticated ? "/search" : "/login"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t("setup.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await setup({ username, password });
    } catch (submitError) {
      setError(submitError.message || t("messages.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-stack">
        <div className="login-brand">
          <div className="login-brand-mark">
            <Icon name="admin_panel_settings" />
          </div>
          <h1>File Anaer</h1>
          <p>{t("setup.subtitle")}</p>
        </div>

        <main className="login-card">
          <div className="login-card-copy">
            <h2>{t("setup.title")}</h2>
            <p>{t("setup.description")}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>{t("setup.username")}</span>
              <div className="login-input-shell">
                <Icon name="person" />
                <input value={username} onChange={(event) => setUsername(event.target.value)} required />
              </div>
            </label>

            <label className="login-field">
              <span>{t("setup.password")}</span>
              <div className="login-input-shell">
                <Icon name="lock" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("setup.passwordHint")}
                  required
                />
                <button
                  type="button"
                  className="login-visibility-button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} />
                </button>
              </div>
            </label>

            <label className="login-field">
              <span>{t("setup.confirmPassword")}</span>
              <div className="login-input-shell">
                <Icon name="verified_user" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("setup.confirmPassword")}
                  required
                />
              </div>
            </label>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="login-submit" disabled={submitting}>
              <span>{submitting ? t("setup.submitting") : t("setup.submit")}</span>
              <Icon name="arrow_forward" />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
