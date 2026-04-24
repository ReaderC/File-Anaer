import { copyText } from "./clipboard";
import { readCopyHostPathSetting } from "./settingsStore";

export async function copyResolvedPath(path, hostPath, showToast, t, fallbackHostPath = "") {
  const preferHostPath = readCopyHostPathSetting();
  const preferredHostPath = hostPath || fallbackHostPath;
  const resolvedPath = preferHostPath && preferredHostPath ? preferredHostPath : path;
  const ok = await copyText(resolvedPath);
  if (!ok) {
    showToast(t("messages.copyFailed"));
    return false;
  }
  if (preferHostPath && preferredHostPath) {
    showToast(t("messages.copyHostPathSuccess"));
    return true;
  }
  if (preferHostPath && !preferredHostPath) {
    showToast(t("messages.copyHostPathFallback"));
    return true;
  }
  showToast(t("messages.copySuccess"));
  return true;
}
