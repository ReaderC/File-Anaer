export function resolveThemeMode(themeMode) {
  if (themeMode === "light" || themeMode === "dark") {
    return themeMode;
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyThemeMode(themeMode) {
  if (typeof document === "undefined") {
    return "light";
  }
  const resolved = resolveThemeMode(themeMode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function readAppliedThemeMode() {
  if (typeof document === "undefined") {
    return "light";
  }
  const applied = document.documentElement.dataset.theme;
  return applied === "dark" ? "dark" : "light";
}

export function watchSystemThemeChange(callback) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => callback(media.matches ? "dark" : "light");
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }
  media.addListener(handler);
  return () => media.removeListener(handler);
}
