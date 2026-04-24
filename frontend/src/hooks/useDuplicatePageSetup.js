import { useEffect } from "react";
import { findRootForPath } from "../lib/pathUtils";

export default function useDuplicatePageSetup({
  activeRoot,
  compareDirectoryPath,
  duplicateQueryAppliedRef,
  duplicateScanModes,
  embedded,
  ignoreList,
  initialConfig,
  isIgnoredPath,
  normalizePathInput,
  primaryDirectoryPath,
  rootPaths,
  rootsLoading,
  scanMode,
  searchParams,
  setForm,
  setSearchParams,
  startDuplicateScan
}) {
  useEffect(() => {
    if (!embedded || duplicateQueryAppliedRef.current || rootsLoading || !rootPaths.length || !initialConfig?.root || !initialConfig?.path) {
      return;
    }
    const resolvedRoot = rootPaths.includes(initialConfig.root) ? initialConfig.root : rootPaths[0] || "";
    const nextForm = {
      mode: duplicateScanModes.includes(initialConfig.mode) ? initialConfig.mode : "folders",
      root: resolvedRoot,
      path: initialConfig.path,
      comparePath: initialConfig.comparePath || "",
      minSizeBytes: initialConfig.minSizeBytes > 0 ? String(initialConfig.minSizeBytes) : ""
    };
    setForm(nextForm);
    duplicateQueryAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      startDuplicateScan({
        mode: nextForm.mode,
        root: nextForm.root,
        path: nextForm.path,
        comparePath: nextForm.comparePath,
        minSizeBytes: Number(initialConfig.minSizeBytes || 0)
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [duplicateQueryAppliedRef, duplicateScanModes, embedded, initialConfig, rootPaths, rootsLoading, setForm, startDuplicateScan]);

  useEffect(() => {
    if (embedded || duplicateQueryAppliedRef.current || rootsLoading || !rootPaths.length) {
      return;
    }
    const modeParam = searchParams.get("mode");
    const rootParam = searchParams.get("root");
    const pathParam = searchParams.get("path");
    const comparePathParam = searchParams.get("comparePath");
    const autoStart = searchParams.get("autostart") === "1";
    if (!modeParam || !rootParam || !pathParam) {
      duplicateQueryAppliedRef.current = true;
      return;
    }
    const resolvedRoot = rootPaths.includes(rootParam) ? rootParam : rootPaths[0] || "";
    const nextForm = {
      mode: duplicateScanModes.includes(modeParam) ? modeParam : "scan",
      root: resolvedRoot,
      path: pathParam,
      comparePath: comparePathParam || "",
      minSizeBytes: ""
    };
    setForm(nextForm);
    duplicateQueryAppliedRef.current = true;
    if (autoStart) {
      const timer = window.setTimeout(() => {
        startDuplicateScan({
          mode: nextForm.mode,
          root: nextForm.root,
          path: nextForm.path,
          comparePath: nextForm.comparePath,
          minSizeBytes: 0
        });
      }, 0);
      setSearchParams({}, { replace: true });
      return () => window.clearTimeout(timer);
    }
    setSearchParams({}, { replace: true });
  }, [duplicateQueryAppliedRef, duplicateScanModes, embedded, rootPaths, rootsLoading, searchParams, setForm, setSearchParams, startDuplicateScan]);

  useEffect(() => {
    if (scanMode === "file") {
      return;
    }
    if (primaryDirectoryPath && isIgnoredPath(primaryDirectoryPath, ignoreList)) {
      setForm((current) => ({ ...current, root: activeRoot, path: activeRoot }));
    }
  }, [activeRoot, ignoreList, isIgnoredPath, primaryDirectoryPath, scanMode, setForm]);

  useEffect(() => {
    if ((scanMode === "folders" || scanMode === "file") && compareDirectoryPath && isIgnoredPath(compareDirectoryPath, ignoreList)) {
      setForm((current) => ({ ...current, comparePath: "" }));
    }
  }, [compareDirectoryPath, ignoreList, isIgnoredPath, scanMode, setForm]);

  useEffect(() => {
    if (!rootPaths.length) return;
    setForm((current) => {
      const pathValid = current.mode === "file"
        ? !current.path || findRootForPath([current.root], normalizePathInput(current.path)) === current.root
        : Boolean(current.path && findRootForPath([current.root], current.path) === current.root);
      const comparePathValid = current.mode === "scan"
        ? current.comparePath === ""
        : !current.comparePath || Boolean(findRootForPath(rootPaths, current.comparePath));
      if (rootPaths.includes(current.root) && pathValid) {
        if (comparePathValid) {
          return current;
        }
        return {
          ...current,
          comparePath: ""
        };
      }
      const nextRoot = rootPaths[0];
      return {
        ...current,
        root: nextRoot,
        path: current.mode === "file" ? current.path : nextRoot,
        comparePath: current.mode === "scan"
          ? ""
          : (comparePathValid ? current.comparePath : "")
      };
    });
  }, [normalizePathInput, rootPaths, setForm]);
}
