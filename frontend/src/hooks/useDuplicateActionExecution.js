import {
  actionMessages,
  applyDuplicateActionResult,
  buildSelectedDuplicateGroups,
  buildHistoryEntry,
  dedupePathList,
  remapSelectedFilePath
} from "../lib/duplicateStateTransforms";

export default function useDuplicateActionExecution({
  activeRoot,
  appendHistoryEntry,
  buildHistoryEntryArgs,
  getJob,
  locale,
  longToastDuration,
  recordDuplicateActionLog,
  runDuplicateAction,
  selectedPathSet,
  selectedPaths,
  setActionLoading,
  setConfirmState,
  setError,
  setJob,
  setReflinkedPaths,
  setSelectedFilePath,
  setSelectedPaths,
  t,
  toast,
  groups
}) {
  async function handleDuplicateAction(mode, options = {}) {
    const dryRun = Boolean(options.dryRun);
    if (mode === "rename" && options.renameMode === "manual" && !options.renameName?.trim()) {
      toast.showToast(t("messages.duplicateRenameNameRequired"));
      return;
    }
    if (!dryRun) {
      setConfirmState(null);
    }

    const selectedGroups = buildSelectedDuplicateGroups(groups, selectedPathSet, mode, options);
    if (!selectedGroups.length) {
      const hasSelectedCopies = selectedPaths.length > 0;
      const message = mode === "rename" && hasSelectedCopies
        ? t("messages.duplicateRenameNoChanges")
        : (dryRun ? t("duplicates.previewNoChanges") : t("messages.duplicateSelectionEmpty"));
      if (dryRun) {
        setConfirmState((current) => current ? ({
          ...current,
          previewResult: null,
          previewError: message
        }) : current);
      }
      toast.showToast(message, longToastDuration);
      return;
    }

    setActionLoading(mode);
    setError("");
    try {
      const result = await runDuplicateAction({
        root: activeRoot,
        mode,
        dryRun,
        renameMode: options.renameMode,
        renameScope: options.renameScope,
        renameName: options.renameName?.trim() || "",
        groups: selectedGroups
      });
      if (dryRun) {
        setConfirmState((current) => current ? ({
          ...current,
          previewResult: result,
          previewError: ""
        }) : current);
        toast.showToast(t("messages.duplicateActionPreviewReady"));
        return;
      }

      const currentJob = getJob();
      const nextJob = applyDuplicateActionResult(currentJob, selectedPaths, mode, result.renamedFiles || []);
      setJob(nextJob);
      if (nextJob?.status === "done" && nextJob?.result) {
        appendHistoryEntry(buildHistoryEntry(nextJob, ...buildHistoryEntryArgs()));
      }
      if (mode === "rename") {
        setSelectedFilePath((current) => remapSelectedFilePath(current, result.renamedFiles || []));
      }
      await recordDuplicateActionLog(mode, result, selectedGroups);
      setSelectedPaths([]);
      if (mode === "reflink") {
        setReflinkedPaths((current) => dedupePathList([...current, ...(result.affectedPaths || [])]));
      }
      const messages = actionMessages(mode, locale);
      toast.showToast(result.needsRescan ? `${messages.success} ${t("messages.duplicateActionRescan")}` : messages.success);
    } catch (requestError) {
      const message = requestError.message || t("messages.duplicateActionFailed");
      setError(message);
      if (dryRun) {
        setConfirmState((current) => current ? ({
          ...current,
          previewResult: null,
          previewError: message
        }) : current);
      }
      toast.showToast(message, longToastDuration);
    } finally {
      setActionLoading("");
    }
  }

  return {
    handleDuplicateAction
  };
}
