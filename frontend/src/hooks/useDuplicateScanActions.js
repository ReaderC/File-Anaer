export default function useDuplicateScanActions({
  activeRoot,
  appendHistoryEntry,
  applyDuplicateRefreshResult,
  buildHistoryEntry,
  canStartDuplicateScan,
  compareDirectoryPath,
  createDuplicateJob,
  fileComparePath,
  form,
  formatDuplicateRefreshMessage,
  ignoreList,
  job,
  locale,
  longToastDuration,
  onBeforeStart,
  primaryDirectoryPath,
  refreshDuplicatePaths,
  scanMode,
  setActionLoading,
  setError,
  setForm,
  setHistoryOpen,
  setJob,
  setJobId,
  setSelectedPaths,
  t,
  toBytes,
  toast,
  unit
}) {
  async function startDuplicateScan({ mode, root, path, comparePath, minSizeBytes }) {
    if (!root || !path) return null;
    if ((mode === "folders" || mode === "file") && !comparePath) return null;
    onBeforeStart?.();
    setError("");
    setSelectedPaths([]);
    const payload = await createDuplicateJob({
      mode,
      root,
      path,
      comparePath,
      ignore: ignoreList,
      minSizeBytes
    }).catch((requestError) => {
      setError(requestError.message);
      return null;
    });
    if (!payload) return null;
    setJobId(payload.jobId);
    setJob(payload);
    return payload;
  }

  async function handleStart() {
    if (!canStartDuplicateScan) {
      const message = scanMode === "folders"
        ? (locale === "en" ? "Choose two different folders to compare." : "请选择两个不同的目录进行对比。")
        : scanMode === "file"
          ? (locale === "en" ? "Enter a file path and choose a target folder." : "请输入文件路径并选择目标目录。")
          : (locale === "en" ? "Choose a folder to scan." : "请选择要扫描的目录。");
      setError(message);
      toast.showToast(message);
      return;
    }
    await startDuplicateScan({
      mode: scanMode,
      root: activeRoot,
      path: scanMode === "file" ? fileComparePath : primaryDirectoryPath,
      comparePath: scanMode === "scan" ? "" : compareDirectoryPath,
      minSizeBytes: toBytes(form.minSizeBytes, unit)
    });
  }

  async function handleRescanCurrent() {
    const resultPath = job?.result?.path || primaryDirectoryPath;
    const resultRoot = job?.result?.root || activeRoot;
    const resultComparePath = job?.result?.comparePath || "";
    const resultMode = job?.result?.mode || "scan";
    const minSizeBytes = Number(form.minSizeBytes || 0);
    const payload = await startDuplicateScan({
      mode: resultMode,
      root: resultRoot,
      path: resultPath,
      comparePath: resultComparePath,
      minSizeBytes
    });
    if (payload) {
      toast.showToast(t("messages.duplicateRescanStarted"));
    }
  }

  async function handleHistoryRescan(entry) {
    if (!entry?.path && !entry?.result?.path) return;
    setHistoryOpen(false);
    setForm({
      mode: entry.mode || entry.result?.mode || "scan",
      root: entry.root || activeRoot,
      path: entry.path || entry.result?.path || primaryDirectoryPath,
      comparePath: entry.comparePath || entry.result?.comparePath || "",
      minSizeBytes: entry.minSizeBytes > 0 ? String(entry.minSizeBytes) : ""
    });
    const payload = await startDuplicateScan({
      mode: entry.mode || entry.result?.mode || "scan",
      root: entry.root || activeRoot,
      path: entry.path || entry.result?.path || primaryDirectoryPath,
      comparePath: entry.comparePath || entry.result?.comparePath || "",
      minSizeBytes: Number(entry.minSizeBytes || 0)
    });
    if (payload) {
      toast.showToast(t("messages.duplicateRescanStarted"));
    }
  }

  async function handleRefreshFileStates() {
    if (!job?.result?.groups?.length) {
      return;
    }
    setActionLoading("refresh");
    setError("");
    try {
      const sourceGroups = job.result.groups || [];
      const result = await refreshDuplicatePaths({
        root: activeRoot,
        groups: sourceGroups.map((group) => ({
          paths: group.files.map((file) => file.path)
        }))
      });
      const retainedPaths = result.retainedPaths || result.existingPaths || [];
      const existingPaths = result.existingPaths || retainedPaths;
      const missingPaths = result.missingPaths || [];
      const nextJob = applyDuplicateRefreshResult(job, retainedPaths);
      setJob(nextJob);
      setSelectedPaths((current) => current.filter((path) => retainedPaths.includes(path)));
      if (nextJob?.status === "done" && nextJob?.result) {
        appendHistoryEntry(buildHistoryEntry(nextJob, activeRoot, primaryDirectoryPath, form.comparePath, form.minSizeBytes, scanMode));
      }
      const missingCount = missingPaths.length;
      const mergedCount = Math.max((existingPaths?.length || 0) - (retainedPaths?.length || 0), 0);
      const removedCount = missingCount + mergedCount;
      const removedGroupCount = Math.max(sourceGroups.length - (nextJob?.result?.groups?.length || 0), 0);
      toast.showToast(
        removedCount
          ? formatDuplicateRefreshMessage({ missingCount, mergedCount, removedGroupCount, locale })
          : (locale === "en" ? "The current duplicate list is still up to date." : "当前重复文件列表状态仍然是最新的。"),
        longToastDuration
      );
    } catch (requestError) {
      const message = requestError.message || t("messages.requestFailed");
      setError(message);
      toast.showToast(message, longToastDuration);
    } finally {
      setActionLoading("");
    }
  }

  return {
    handleHistoryRescan,
    handleRefreshFileStates,
    handleRescanCurrent,
    handleStart,
    startDuplicateScan
  };
}
