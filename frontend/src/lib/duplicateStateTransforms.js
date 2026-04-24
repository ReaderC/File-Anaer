import { duplicateActionModeLabel } from "./duplicatePresentation";

export function dedupePathList(items) {
  return [...new Set(items.filter(Boolean))];
}

export function buildDuplicateActionLogEntry({ root, mode, result, locale, primaryPath, comparePath, scanMode, selectedGroups }) {
  const label = duplicateActionModeLabel(mode, locale);
  const savedAt = new Date().toISOString();
  return {
    id: `dup-action-${savedAt}-${mode}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt,
    root,
    mode,
    scanMode,
    primaryPath,
    comparePath,
    title: locale === "en" ? `${label} completed` : `${label}已完成`,
    summary: locale === "en"
      ? `${result.fileCount || 0} files across ${result.groupCount || 0} groups`
      : `${result.groupCount || 0} 组，共 ${result.fileCount || 0} 个文件`,
    selectedGroups,
    result,
    rollback: mode === "rename" && result.renamedFiles?.length
      ? { kind: "rename", files: result.renamedFiles }
      : { kind: "none" },
    rollbackStatus: "ready"
  };
}

export function applyDuplicateActionResult(currentJob, selectedPaths, mode, renamedFiles = []) {
  if (!currentJob?.result || mode === "reflink") {
    return currentJob;
  }
  if (mode === "rename") {
    return applyDuplicateRenameResult(currentJob, renamedFiles);
  }
  const selectedSet = new Set(selectedPaths);
  const nextGroups = currentJob.result.groups
    .map((group) => {
      const files = group.files.filter((file) => !selectedSet.has(file.path));
      if (files.length < 2) return null;
      return {
        ...group,
        files,
        fileCount: files.length,
        wastedBytes: Math.max(files.length - 1, 0) * group.sizeBytes
      };
    })
    .filter(Boolean);

  const totalFiles = nextGroups.reduce((sum, group) => sum + group.fileCount, 0);
  const totalWastedBytes = nextGroups.reduce((sum, group) => sum + group.wastedBytes, 0);

  return {
    ...currentJob,
    result: {
      ...currentJob.result,
      groups: nextGroups,
      totalGroups: nextGroups.length,
      totalFiles,
      totalWastedBytes,
      updatedAt: new Date().toISOString()
    }
  };
}

export function applyDuplicateRenameResult(currentJob, renamedFiles) {
  if (!currentJob?.result || !renamedFiles.length) {
    return currentJob;
  }
  const renamedMap = new Map(renamedFiles.map((item) => [item.oldPath, item.newPath]));
  const nextGroups = currentJob.result.groups.map((group) => ({
    ...group,
    files: group.files.map((file) => {
      const nextPath = renamedMap.get(file.path);
      if (!nextPath) {
        return file;
      }
      const nextName = nextPath.split("/").pop() || nextPath.split("\\").pop() || file.name;
      const nextParentPath = nextPath.replace(/[\\/][^\\/]+$/, "") || file.parentPath;
      const nextParentHostPath = file.parentHostPath || file.hostPath?.replace(/[\\/][^\\/]+$/, "") || "";
      return {
        ...file,
        path: nextPath,
        name: nextName,
        parentPath: nextParentPath,
        parentHostPath: nextParentHostPath,
        hostPath: nextParentHostPath ? `${nextParentHostPath}/${nextName}`.replace(/\\/g, "/") : file.hostPath
      };
    })
  }));

  return {
    ...currentJob,
    result: {
      ...currentJob.result,
      groups: nextGroups,
      updatedAt: new Date().toISOString()
    }
  };
}

export function remapSelectedFilePath(selectedFilePath, renamedFiles) {
  if (!selectedFilePath || !renamedFiles.length) {
    return selectedFilePath;
  }
  const match = renamedFiles.find((item) => item.oldPath === selectedFilePath);
  return match?.newPath || selectedFilePath;
}

export function remapSelectedPaths(selectedPaths, renamedFiles) {
  if (!selectedPaths.length || !renamedFiles.length) {
    return selectedPaths;
  }
  const renamedMap = new Map(renamedFiles.map((item) => [item.oldPath, item.newPath]));
  return dedupePathList(selectedPaths.map((path) => renamedMap.get(path) || path));
}

export function applyDuplicateRefreshResult(currentJob, existingPaths) {
  if (!currentJob?.result) {
    return currentJob;
  }
  const existingSet = new Set(existingPaths || []);
  const nextGroups = currentJob.result.groups
    .map((group) => {
      const files = group.files.filter((file) => existingSet.has(file.path));
      if (files.length < 2) {
        return null;
      }
      return {
        ...group,
        files,
        fileCount: files.length,
        wastedBytes: Math.max(files.length - 1, 0) * group.sizeBytes
      };
    })
    .filter(Boolean);

  const totalFiles = nextGroups.reduce((sum, group) => sum + group.fileCount, 0);
  const totalWastedBytes = nextGroups.reduce((sum, group) => sum + group.wastedBytes, 0);

  return {
    ...currentJob,
    result: {
      ...currentJob.result,
      groups: nextGroups,
      totalGroups: nextGroups.length,
      totalFiles,
      totalWastedBytes,
      updatedAt: new Date().toISOString()
    }
  };
}

export function getKeeperPath(group, selectedPathSet) {
  const keepers = (group?.files || []).filter((file) => !selectedPathSet.has(file.path));
  return keepers[keepers.length - 1]?.path || "";
}

export function buildSelectedDuplicateGroups(groups, selectedPathSet, mode, options = {}) {
  return groups
    .map((group) => {
      const selectedInGroup = group.files.filter((file) => selectedPathSet.has(file.path));
      if (!selectedInGroup.length) return null;
      const keepPath = getKeeperPath(group, selectedPathSet) || (mode === "rename" ? group.files[0]?.path || "" : "");
      if (mode !== "delete" && !keepPath) return null;
      const targetSelectedPaths = mode === "rename" && options.renameScope === "copies"
        ? selectedInGroup.filter((file) => file.path !== keepPath).map((file) => file.path)
        : selectedInGroup.map((file) => file.path);
      if (!targetSelectedPaths.length) return null;
      return {
        hash: group.hash,
        keepPath,
        selectedPaths: targetSelectedPaths
      };
    })
    .filter(Boolean);
}

export function actionMessages(mode, locale) {
  if (locale === "en") {
    switch (mode) {
      case "delete":
        return {
          title: "Delete duplicate copies",
          confirm: "Selected duplicate copy files will be permanently deleted.",
          success: "Duplicate copies deleted."
        };
      case "rename":
        return {
          title: "Rename duplicate copies",
          confirm: "Selected duplicate copy files will be renamed in place.",
          success: "Selected copies renamed."
        };
      case "hardlink":
        return {
          title: "Replace with hardlinks",
          confirm: "Selected duplicate copy files will be replaced with hardlinks pointing to the kept file.",
          success: "Selected copies replaced with hardlinks."
        };
      case "symlink":
        return {
          title: "Replace with symlinks",
          confirm: "Selected duplicate copy files will be replaced with symlinks pointing to the kept file.",
          success: "Selected copies replaced with symlinks."
        };
      case "reflink":
        return {
          title: "Deduplicate with reflink",
          confirm: "Selected duplicate copy files will share blocks with the kept file when the filesystem supports reflinks.",
          success: "Reflink deduplication completed."
        };
      default:
        return {
          title: "Confirm duplicate action",
          confirm: "Apply the selected duplicate action to the checked files?",
          success: "Duplicate operation completed."
        };
    }
  }

  switch (mode) {
    case "delete":
      return {
        title: "删除重复副本",
        confirm: "已勾选的重复副本文件会被直接永久删除。",
        success: "已删除勾选的重复副本。"
      };
    case "rename":
      return {
        title: "重命名重复文件",
        confirm: "已勾选的重复副本会在原目录内重命名。",
        success: "已完成重命名。"
      };
    case "hardlink":
      return {
        title: "替换为硬链接",
        confirm: "已勾选的重复副本文件会被替换为指向保留文件的硬链接。",
        success: "已将勾选副本替换为硬链接。"
      };
    case "symlink":
      return {
        title: "替换为软链接",
        confirm: "已勾选的重复副本文件会被替换为指向保留文件的软链接。",
        success: "已将勾选副本替换为软链接。"
      };
    case "reflink":
      return {
        title: "执行 Reflink 去重",
        confirm: "已勾选的重复副本文件会尝试与保留文件共享底层块，是否成功取决于文件系统能力。",
        success: "已执行 Reflink 去重。"
      };
    default:
      return {
        title: "确认重复文件操作",
        confirm: "确认对勾选的重复文件执行当前操作吗？",
        success: "重复文件操作已完成。"
      };
  }
}

export function buildHistoryEntry(job, root, path, comparePath, minSizeBytes, mode) {
  const result = job?.result;
  if (!result?.groups?.length && result?.totalGroups == null) return null;
  const createdAt = job.createdAt || result.updatedAt || new Date().toISOString();
  const savedAt = result.updatedAt || job.createdAt || new Date().toISOString();
  return {
    id: [createdAt, result.mode || mode || "scan", result.path || path, result.comparePath || comparePath || "", minSizeBytes || 0].join("|"),
    savedAt,
    createdAt,
    mode: result.mode || mode || "scan",
    root: result.root || root,
    path: result.path || path,
    comparePath: result.comparePath || comparePath || "",
    minSizeBytes: Number(minSizeBytes || 0),
    totalGroups: Number(result.totalGroups || 0),
    totalFiles: Number(result.totalFiles || 0),
    totalWastedBytes: Number(result.totalWastedBytes || 0),
    result
  };
}
