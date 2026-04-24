export default function useDuplicatePathActions({
  activeRoot,
  activeRootHostPath,
  copyPreferredPath,
  copyText,
  deriveHostPath,
  locale,
  preferHostPath,
  selectedPathSet,
  t,
  toast
}) {
  function resolveDisplayPath(path, hostPath = "") {
    if (!path) {
      return "";
    }
    if (!preferHostPath) {
      return path;
    }
    return hostPath || deriveHostPath(path, activeRoot, activeRootHostPath) || path;
  }

  async function handleCopy(path, hostPath) {
    await copyPreferredPath(path, hostPath, toast.showToast, t, deriveHostPath(path, activeRoot, activeRootHostPath));
  }

  async function handleCopyGroupPaths(group, onlySelected = false) {
    const files = (group?.files || []).filter((file) => !onlySelected || selectedPathSet.has(file.path));
    if (!files.length) {
      toast.showToast(locale === "en" ? "No paths to copy in this group." : "当前组没有可复制的路径。");
      return;
    }
    const content = files
      .map((file) => resolveDisplayPath(file.path, file.hostPath))
      .filter(Boolean)
      .join("\n");
    const ok = await copyText(content);
    if (!ok) {
      toast.showToast(locale === "en" ? "Failed to copy group paths." : "复制当前组路径失败。");
      return;
    }
    if (preferHostPath && files.some((file) => file.hostPath || deriveHostPath(file.path, activeRoot, activeRootHostPath))) {
      toast.showToast(locale === "en"
        ? `Copied ${files.length} host paths from this group.`
        : `已复制当前组 ${files.length} 条宿主机路径。`);
      return;
    }
    if (preferHostPath) {
      toast.showToast(locale === "en"
        ? `Copied ${files.length} paths from this group (host paths unavailable, fell back to scan paths).`
        : `已复制当前组 ${files.length} 条路径；宿主机路径不可用，已回退为扫描路径。`);
      return;
    }
    toast.showToast(locale === "en"
      ? `Copied ${files.length} paths from this group.`
      : `已复制当前组 ${files.length} 条路径。`);
  }

  return {
    handleCopy,
    handleCopyGroupPaths,
    resolveDisplayPath
  };
}
