import { useState } from "react";
import { Navigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useI18n } from "../lib/i18n.jsx";

export default function LoginPage() {
  const { authEnabled, isAuthenticated, login } = useAuth();
  const { t, locale } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!authEnabled || isAuthenticated) {
    return <Navigate to="/search" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login({ username, password, rememberMe: false });
    } catch (submitError) {
      setError(localizeLoginError(submitError?.message, locale, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-stack">
        <div className="login-brand">
          <div className="login-brand-mark">
            <Icon name="storage" />
          </div>
          <h1>File Anaer</h1>
          <p>{t("auth.subtitle")}</p>
        </div>

        <main className="login-card">
          <div className="login-card-copy">
            <h2>{t("auth.title")}</h2>
            <p>{t("auth.description")}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>{t("auth.username")}</span>
              <div className="login-input-shell">
                <Icon name="person" />
                <input
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t("auth.usernamePlaceholder")}
                  required
                />
              </div>
            </label>

            <label className="login-field">
              <span>{t("auth.password")}</span>
              <div className="login-input-shell">
                <Icon name="lock" />
                <input
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
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

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="login-submit" disabled={submitting}>
              <span>{submitting ? t("auth.signingIn") : t("auth.signIn")}</span>
              <Icon name="login" />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

function localizeLoginError(message, locale, t) {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) {
    return t("messages.requestFailed");
  }
  if (normalized === "invalid username or password") {
    return locale === "en" ? "Invalid username or password." : "用户名或密码错误。";
  }
  if (normalized === "invalid login request") {
    return locale === "en" ? "Login request is invalid." : "登录请求无效。";
  }
  if (normalized === "authentication required") {
    return locale === "en" ? "Authentication is required." : "需要先登录。";
  }
  if (normalized === "initial setup required") {
    return locale === "en" ? "Initial setup is required first." : "请先完成初始化设置。";
  }
  return message || t("messages.requestFailed");
}
