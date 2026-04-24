import { findRootForPath } from "./pathUtils";

export function normalizePathInput(value) {
  return value.trim().replace(/\\/g, "/");
}

export function canStartDuplicateScan({ scanMode, activeRoot, primaryDirectoryPath, compareDirectoryPath, fileComparePath }) {
  if (!activeRoot) {
    return false;
  }
  if (scanMode === "file") {
    return Boolean(
      fileComparePath &&
      findRootForPath([activeRoot], fileComparePath) === activeRoot &&
      compareDirectoryPath
    );
  }
  if (!primaryDirectoryPath || findRootForPath([activeRoot], primaryDirectoryPath) !== activeRoot) {
    return false;
  }
  if (scanMode === "folders") {
    return Boolean(compareDirectoryPath && compareDirectoryPath !== primaryDirectoryPath);
  }
  return true;
}

export function findSharedFolderPaths(files, resolveDisplayPath, clusterColors) {
  const folderEntries = new Map();
  for (const file of files || []) {
    const displayParentPath = resolveDisplayPath(file.parentPath, file.parentHostPath);
    if (!displayParentPath) {
      continue;
    }
    const entry = folderEntries.get(displayParentPath) || { count: 0, names: new Set() };
    entry.count += 1;
    entry.names.add(file.name || "");
    folderEntries.set(displayParentPath, entry);
  }

  const sharedPaths = new Map();
  let clusterIndex = 0;
  for (const [folderPath, entry] of [...folderEntries.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"))) {
    if (entry.count >= 2 && entry.names.size >= 2) {
      sharedPaths.set(folderPath, clusterColors[clusterIndex % clusterColors.length]);
      clusterIndex += 1;
    }
  }
  return sharedPaths;
}

export function displayPathName(file, displayParentPath) {
  if (file?.name) {
    return file.name;
  }
  const resolvedPath = String(file?.hostPath || file?.path || "").replace(/\\/g, "/");
  const normalizedParent = String(displayParentPath || "").replace(/\\/g, "/").replace(/[\\/]+$/, "");
  if (normalizedParent && resolvedPath.startsWith(`${normalizedParent}/`)) {
    return resolvedPath.slice(normalizedParent.length + 1);
  }
  return resolvedPath.split("/").pop() || resolvedPath;
}

export function ensureTrailingSlash(value) {
  if (!value) {
    return "";
  }
  return /[\\/]$/.test(value) ? value : `${value}/`;
}

export function buildDuplicateExportFilename() {
  return `duplicate-results-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
}

export function normalizeDuplicatePageError(message, t) {
  const text = String(message || "").trim();
  if (!text) {
    return "";
  }
  const lowered = text.toLowerCase();
  if (lowered.includes("no duplicate files selected")) {
    return t("messages.duplicateSelectionEmpty");
  }
  if (lowered.includes("file compare mode requires one file and one target folder")) {
    return "文件对目录模式需要选择一个文件和一个目标目录。";
  }
  if (lowered === "request failed") {
    return t("messages.requestFailed");
  }
  return text;
}
