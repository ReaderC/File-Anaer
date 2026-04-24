import { useMemo, useState } from "react";
import useDirectories from "./useDirectories";
import { findRootForPath, parentPath } from "../lib/pathUtils";

export default function useDuplicatePicker({
  activeRoot,
  compareDirectoryPath,
  fileComparePath,
  ignoreList,
  locale,
  primaryDirectoryPath,
  rootPaths,
  scanMode,
  setForm
}) {
  const [pickerState, setPickerState] = useState(null);

  const pickerRoot = pickerState?.root || activeRoot;
  const pickerBrowsePath = pickerState?.browsePath || activeRoot;
  const pickerDirectories = useDirectories(pickerRoot, pickerBrowsePath, pickerState?.mode === "file");

  const pickerTitle = useMemo(() => {
    if (pickerState?.target === "compare") {
      return scanMode === "folders"
        ? (locale === "en" ? "Select Compare Folder" : "选择对比目录")
        : (locale === "en" ? "Select Target Folder" : "选择目标目录");
    }
    if (pickerState?.target === "file") {
      return locale === "en" ? "Select File" : "选择文件";
    }
    return locale === "en" ? "Select Folder" : "选择目录";
  }, [locale, pickerState?.target, scanMode]);

  const pickerSearchPlaceholder = locale === "en" ? "Search files or folders..." : "搜索文件或目录...";

  function openPicker(target) {
    if (!activeRoot) {
      return;
    }
    const targetRoot = target === "compare"
      ? (findRootForPath(rootPaths, compareDirectoryPath) || activeRoot)
      : target === "file"
        ? (findRootForPath(rootPaths, fileComparePath) || activeRoot)
        : activeRoot;
    const initialBrowsePath = target === "compare"
      ? compareDirectoryPath
      : target === "file"
        ? parentPath(fileComparePath, targetRoot)
        : primaryDirectoryPath;
    setPickerState({
      target,
      mode: target === "file" ? "file" : "folder",
      root: targetRoot,
      browsePath: initialBrowsePath,
      selectedPath: target === "compare" ? compareDirectoryPath : target === "file" ? fileComparePath : primaryDirectoryPath
    });
  }

  function closePicker() {
    setPickerState(null);
  }

  function handlePickerConfirm(selectedPath) {
    if (!pickerState?.target || !selectedPath) {
      setPickerState(null);
      return;
    }
    setForm((current) => {
      if (pickerState.target === "compare") {
        return { ...current, comparePath: selectedPath };
      }
      const nextRoot = findRootForPath(rootPaths, selectedPath) || pickerState.root || activeRoot;
      return { ...current, root: nextRoot, path: selectedPath };
    });
    setPickerState(null);
  }

  function handlePickerRootChange(value) {
    setPickerState((current) => current
      ? {
          ...current,
          root: value,
          browsePath: value,
          selectedPath: current.mode === "folder" ? value : current.selectedPath
        }
      : current);
  }

  function handlePickerBrowsePathChange(value) {
    setPickerState((current) => current ? ({ ...current, browsePath: value }) : current);
  }

  return {
    closePicker,
    handlePickerBrowsePathChange,
    handlePickerConfirm,
    handlePickerRootChange,
    openPicker,
    pickerBrowsePath,
    pickerDirectories,
    pickerMode: pickerState?.mode || "folder",
    pickerOpen: Boolean(pickerState),
    pickerRoot,
    pickerSearchPlaceholder,
    pickerSelectedPath: pickerState?.selectedPath || "",
    pickerIgnoreList: ignoreList,
    pickerTitle
  };
}
