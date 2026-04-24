import { useEffect } from "react";

export default function useDuplicateSelectionState({
  allGroupFilePathSet,
  allowFullGroupSelection,
  currentGroupFilePathSet,
  groups,
  selectedFilePath,
  setSelectedFilePath,
  setSelectedPaths
}) {
  useEffect(() => {
    if (!selectedFilePath && groups[0]?.files?.[0]?.path) {
      setSelectedFilePath(groups[0].files[0].path);
      return;
    }
    if (selectedFilePath && !currentGroupFilePathSet.has(selectedFilePath)) {
      setSelectedFilePath(groups[0]?.files?.[0]?.path || "");
    }
  }, [currentGroupFilePathSet, groups, selectedFilePath, setSelectedFilePath]);

  useEffect(() => {
    setSelectedPaths((current) => {
      const next = current.filter((path) => allGroupFilePathSet.has(path));
      if (next.length === current.length && next.every((path, index) => path === current[index])) {
        return current;
      }
      return next;
    });
  }, [allGroupFilePathSet, setSelectedPaths]);

  useEffect(() => {
    if (allowFullGroupSelection) {
      return;
    }
    setSelectedPaths((current) => {
      if (!current.length) {
        return current;
      }
      const currentSet = new Set(current);
      let changed = false;
      const nextSet = new Set(current);
      for (const group of groups) {
        if (!group.files.length || !group.files.every((file) => currentSet.has(file.path))) {
          continue;
        }
        nextSet.delete(group.files[group.files.length - 1]?.path);
        changed = true;
      }
      if (!changed) {
        return current;
      }
      const next = current.filter((path) => nextSet.has(path));
      return next.length === current.length && next.every((path, index) => path === current[index]) ? current : next;
    });
  }, [allowFullGroupSelection, groups, setSelectedPaths]);
}
