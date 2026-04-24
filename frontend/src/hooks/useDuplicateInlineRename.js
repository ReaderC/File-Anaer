import { useState } from "react";

export default function useDuplicateInlineRename({
  activeRoot,
  applyDuplicateActionResult,
  duplicateActionFailedMessage,
  locale,
  longToastDuration,
  getJob,
  remapSelectedFilePath,
  remapSelectedPaths,
  runDuplicateAction,
  setError,
  setJob,
  setSelectedFilePath,
  setSelectedPaths,
  toast,
  duplicateRenameNameRequiredMessage,
  duplicateRenameNoChangesMessage,
  onRecordActionLog
}) {
  const [inlineRenamePath, setInlineRenamePath] = useState("");
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [inlineRenameLoading, setInlineRenameLoading] = useState("");

  function beginInlineRename(file) {
    setInlineRenamePath(file.path);
    setInlineRenameValue(file.name || "");
  }

  function cancelInlineRename() {
    setInlineRenamePath("");
    setInlineRenameValue("");
    setInlineRenameLoading("");
  }

  async function submitInlineRename(group, file) {
    const renameName = inlineRenameValue.trim();
    if (!renameName) {
      toast.showToast(duplicateRenameNameRequiredMessage);
      return;
    }
    const keepPath = group.files.find((item) => item.path !== file.path)?.path || "";
    if (!keepPath) {
      toast.showToast(duplicateRenameNoChangesMessage);
      return;
    }
    setInlineRenameLoading(file.path);
    setError("");
    try {
      const result = await runDuplicateAction({
        root: activeRoot,
        mode: "rename",
        dryRun: false,
        renameMode: "manual",
        renameScope: "copies",
        renameName,
        groups: [{
          hash: group.hash,
          keepPath,
          selectedPaths: [file.path]
        }]
      });
      const nextJob = applyDuplicateActionResult(getJob(), [file.path], "rename", result.renamedFiles || []);
      setJob(nextJob);
      setSelectedFilePath((current) => remapSelectedFilePath(current, result.renamedFiles || []));
      setSelectedPaths((current) => remapSelectedPaths(current, result.renamedFiles || []));
      await onRecordActionLog("rename", result, [{
        hash: group.hash,
        keepPath,
        selectedPaths: [file.path]
      }]);
      toast.showToast(locale === "en" ? "File renamed." : "文件已重命名。");
      cancelInlineRename();
    } catch (requestError) {
      const message = requestError.message || duplicateActionFailedMessage;
      setError(message);
      toast.showToast(message, longToastDuration);
    } finally {
      setInlineRenameLoading("");
    }
  }

  return {
    beginInlineRename,
    cancelInlineRename,
    inlineRenameLoading,
    inlineRenamePath,
    inlineRenameValue,
    setInlineRenameValue,
    submitInlineRename
  };
}
