import { useState } from "react";
import { downloadTextFile, toDelimitedText } from "../lib/export";
import { getExtensionLabel } from "../lib/previewFile";

export default function useDuplicateExport({
  buildDuplicateExportFilename,
  exportCompletedMessage,
  getKeeperPath,
  groups,
  locale,
  longToastDuration,
  requestFailedMessage,
  selectedPathSet,
  t,
  toast
}) {
  const [exporting, setExporting] = useState(false);

  function handleExportDuplicates() {
    if (!groups.length) {
      return;
    }
    setExporting(true);
    try {
      const content = toDelimitedText(
        locale === "en"
          ? ["Group Hash", "Group Index", "File Count", "Group Size Bytes", "Wasted Bytes", "Suggested Keeper", "Path", "Host Path", "Parent Path", "Parent Host Path", "Name", "Extension", "Modified At", "Selected"]
          : ["分组哈希", "分组序号", "文件数量", "分组大小(字节)", "可回收字节", "建议保留文件", "路径", "宿主机路径", "父级路径", "父级宿主机路径", "名称", "扩展名", "修改时间", "是否已选中"],
        groups.flatMap((group, groupIndex) => {
          const keeperPath = getKeeperPath(group, selectedPathSet) || group.files[group.files.length - 1]?.path || "";
          return group.files.map((file) => ([
            group.hash,
            groupIndex + 1,
            group.fileCount,
            group.sizeBytes,
            group.wastedBytes,
            keeperPath,
            file.path,
            file.hostPath || "",
            file.parentPath,
            file.parentHostPath || "",
            file.name,
            getExtensionLabel(file.name).replace(/^\./, ""),
            file.modifiedAt,
            selectedPathSet.has(file.path) ? (locale === "en" ? "true" : "是") : (locale === "en" ? "false" : "否")
          ]));
        })
      );
      downloadTextFile(buildDuplicateExportFilename(), content, "text/csv;charset=utf-8");
      toast.showToast(exportCompletedMessage || t("messages.exportCompleted"));
    } catch (error) {
      toast.showToast(error?.message || requestFailedMessage || t("messages.requestFailed"), longToastDuration);
    } finally {
      setExporting(false);
    }
  }

  return {
    exporting,
    handleExportDuplicates
  };
}
