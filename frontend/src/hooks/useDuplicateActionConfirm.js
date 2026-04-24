import { actionMessages } from "../lib/duplicateStateTransforms";

export default function useDuplicateActionConfirm({
  activeRootWritable,
  confirmState,
  duplicateKeeperRequiredForLinkMessage,
  duplicateSelectionEmptyMessage,
  handleDuplicateAction,
  getKeeperPath,
  groups,
  locale,
  selectedPathSet,
  selectedPaths,
  setConfirmState,
  t,
  toast
}) {
  const confirmActionMessages = confirmState ? actionMessages(confirmState.mode, locale) : null;

  function requestDuplicateAction(mode) {
    if (!activeRootWritable) {
      toast.showToast(t("messages.duplicateActionReadOnly"));
      return;
    }
    if (!selectedPaths.length) {
      toast.showToast(duplicateSelectionEmptyMessage);
      return;
    }
    if (mode !== "delete" && mode !== "rename" && groups.some((group) => group.files.some((file) => selectedPathSet.has(file.path)) && !getKeeperPath(group, selectedPathSet))) {
      toast.showToast(duplicateKeeperRequiredForLinkMessage);
      return;
    }
    setConfirmState(mode === "rename"
      ? { mode, renameMode: "keeper", renameScope: "copies", renameName: "", previewResult: null, previewError: "" }
      : { mode, previewResult: null, previewError: "" });
  }

  function handleConfirmStateChange(patch) {
    setConfirmState((current) => current ? ({ ...current, ...patch }) : current);
  }

  function handleCloseConfirm() {
    setConfirmState(null);
  }

  function handleConfirmAction() {
    if (confirmState) {
      handleDuplicateAction(confirmState.mode, confirmState);
    }
  }

  function handlePreviewAction() {
    if (confirmState) {
      handleDuplicateAction(confirmState.mode, { ...confirmState, dryRun: true });
    }
  }

  return {
    confirmMessage: confirmActionMessages?.confirm || "",
    confirmState,
    confirmTitle: confirmActionMessages?.title || "",
    handleCloseConfirm,
    handleConfirmAction,
    handleConfirmStateChange,
    handlePreviewAction,
    requestDuplicateAction
  };
}
