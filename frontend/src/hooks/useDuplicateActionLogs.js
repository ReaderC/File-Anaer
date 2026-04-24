import { useEffect, useMemo, useState } from "react";
import { clearDuplicateActionLogs, deleteDuplicateActionLog, listDuplicateActionLogs, saveDuplicateActionLog } from "../lib/duplicateActionLog";

export default function useDuplicateActionLogs({
  actionLogLimit,
  activeRoot,
  applyDuplicateRenameResult,
  buildDuplicateActionLogEntry,
  comparePath,
  getJob,
  locale,
  longToastDuration,
  primaryPath,
  requestFailedMessage,
  remapSelectedFilePath,
  runUndoRename,
  scanMode,
  setError,
  setJob,
  setSelectedFilePath,
  toast
}) {
  const [actionLogs, setActionLogs] = useState([]);
  const [actionLogsOpen, setActionLogsOpen] = useState(false);
  const [actionLogFilter, setActionLogFilter] = useState("all");
  const [undoLoading, setUndoLoading] = useState("");

  useEffect(() => {
    let cancelled = false;
    listDuplicateActionLogs(actionLogLimit)
      .then((entries) => {
        if (!cancelled) {
          setActionLogs(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActionLogs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [actionLogLimit]);

  const filteredActionLogs = useMemo(
    () => actionLogs.filter((entry) => matchesActionLogFilter(entry, actionLogFilter)),
    [actionLogFilter, actionLogs]
  );

  async function handleActionLogClear() {
    try {
      setActionLogs(await clearDuplicateActionLogs());
      toast.showToast(locale === "en" ? "Action logs cleared." : "操作日志已清空。");
    } catch (requestError) {
      toast.showToast(requestError.message || requestFailedMessage);
    }
  }

  async function handleActionLogDelete(entryId) {
    try {
      setActionLogs(await deleteDuplicateActionLog(entryId, actionLogLimit));
      toast.showToast(locale === "en" ? "Action log removed." : "操作日志已删除。");
    } catch (requestError) {
      toast.showToast(requestError.message || requestFailedMessage);
    }
  }

  async function recordDuplicateActionLog(mode, result, selectedGroups = []) {
    const entry = buildDuplicateActionLogEntry({
      root: activeRoot,
      mode,
      result,
      locale,
      primaryPath,
      comparePath,
      scanMode,
      selectedGroups
    });
    try {
      setActionLogs(await saveDuplicateActionLog(entry, actionLogLimit));
    } catch {
      toast.showToast(locale === "en" ? "Failed to save action log." : "保存操作日志失败。");
    }
  }

  async function handleUndoActionLog(entry) {
    if (!entry?.rollback?.kind || entry.rollback.kind !== "rename" || !entry.rollback.files?.length) {
      return;
    }
    setUndoLoading(entry.id);
    setError("");
    try {
      const result = await runUndoRename({
        root: entry.root,
        renamedFiles: entry.rollback.files
      });
      const restoredFiles = result.restoredFiles || [];
      const reversed = restoredFiles.map((item) => ({
        oldPath: item.newPath,
        newPath: item.oldPath
      }));
      const nextJob = applyDuplicateRenameResult(getJob(), reversed);
      setJob(nextJob);
      setSelectedFilePath((current) => remapSelectedFilePath(current, reversed));
      const nextLogs = await saveDuplicateActionLog({
        ...entry,
        rollbackStatus: "undone",
        rollbackCompletedAt: new Date().toISOString()
      }, actionLogLimit);
      setActionLogs(nextLogs);
      toast.showToast(locale === "en" ? "Rename rollback completed." : "重命名回滚已完成。");
    } catch (requestError) {
      const message = requestError.message || (locale === "en" ? "Failed to rollback rename." : "回滚重命名失败。");
      setError(message);
      toast.showToast(message, longToastDuration);
    } finally {
      setUndoLoading("");
    }
  }

  return {
    actionLogFilter,
    actionLogs,
    actionLogsOpen,
    filteredActionLogs,
    setActionLogFilter,
    setActionLogsOpen,
    undoLoading,
    handleActionLogClear,
    handleActionLogDelete,
    handleUndoActionLog,
    recordDuplicateActionLog
  };
}

function matchesActionLogFilter(entry, filter) {
  if (filter === "undoable") {
    return entry.rollback?.kind === "rename";
  }
  if (filter === "rename") {
    return entry.mode === "rename";
  }
  if (filter === "other") {
    return entry.mode !== "rename";
  }
  return true;
}
