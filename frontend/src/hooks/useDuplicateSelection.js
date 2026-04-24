export default function useDuplicateSelection({
  allowFullGroupSelection,
  compareDirectoryPath,
  dedupePathList,
  duplicateFileTime,
  getComparedFolderSides,
  getKeeperPath,
  groups,
  locale,
  primaryDirectoryPath,
  selectedPathSet,
  setSelectedPaths,
  t,
  toast,
  visibleGroups
}) {
  function toggleSelectedPath(path, group) {
    setSelectedPaths((current) => {
      if (current.includes(path)) {
        return current.filter((item) => item !== path);
      }
      const next = [...current, path];
      if (!allowFullGroupSelection && group.files.every((file) => next.includes(file.path))) {
        const fallbackKeeperPath = [...(group?.files || [])]
          .reverse()
          .find((file) => file.path !== path && current.includes(file.path))
          ?.path;
        if (!fallbackKeeperPath) {
          toast.showToast(t("messages.duplicateGroupKeepRequired"));
          return current;
        }
        return dedupePathList([
          ...current.filter((item) => item !== fallbackKeeperPath),
          path
        ]);
      }
      return next;
    });
  }

  function toggleFullGroupSelection(group) {
    if (!allowFullGroupSelection || !group?.files?.length) {
      return;
    }
    const groupPaths = group.files.map((file) => file.path);
    const allSelected = groupPaths.every((path) => selectedPathSet.has(path));
    setSelectedPaths((current) => {
      if (allSelected) {
        return current.filter((path) => !groupPaths.includes(path));
      }
      return dedupePathList([...current, ...groupPaths]);
    });
  }

  function clearGroupSelection(group) {
    const groupPaths = (group?.files || []).map((file) => file.path);
    if (!groupPaths.length) {
      return;
    }
    setSelectedPaths((current) => current.filter((path) => !groupPaths.includes(path)));
  }

  function invertGroupSelection(group) {
    const groupPaths = (group?.files || []).map((file) => file.path);
    if (!groupPaths.length) {
      return;
    }
    setSelectedPaths((current) => {
      const currentSet = new Set(current);
      const currentGroupSelectedCount = groupPaths.reduce((count, path) => count + (currentSet.has(path) ? 1 : 0), 0);
      const invertedSelectedPaths = groupPaths.filter((path) => !currentSet.has(path));
      let nextGroupSelection = invertedSelectedPaths;
      if (!allowFullGroupSelection && currentGroupSelectedCount === 0) {
        const fallbackKeeper = group.files[group.files.length - 1]?.path || groupPaths[groupPaths.length - 1];
        nextGroupSelection = invertedSelectedPaths.filter((path) => path !== fallbackKeeper);
      }
      if (!allowFullGroupSelection && nextGroupSelection.length >= groupPaths.length) {
        const fallbackKeeper = getKeeperPath(group, currentSet) || group.files[group.files.length - 1]?.path || groupPaths[groupPaths.length - 1];
        nextGroupSelection = nextGroupSelection.filter((path) => path !== fallbackKeeper);
      }
      if (!allowFullGroupSelection && nextGroupSelection.length >= groupPaths.length) {
        nextGroupSelection = nextGroupSelection.slice(0, Math.max(groupPaths.length - 1, 0));
      }
      const outsideGroupPaths = current.filter((path) => !groupPaths.includes(path));
      return dedupePathList([...outsideGroupPaths, ...nextGroupSelection]);
    });
  }

  function collectQuickSelectionPaths(group, strategy) {
    if (!group.files || group.files.length < 2) {
      return [];
    }
    let keeperIndex = strategy === "first" ? 0 : group.files.length - 1;
    if (strategy === "newest" || strategy === "oldest") {
      const ranked = [...group.files]
        .map((file, index) => ({ index, time: duplicateFileTime(file), path: file.path }))
        .sort((left, right) => {
          if (strategy === "newest") {
            return right.time - left.time || right.path.localeCompare(left.path, "zh-CN");
          }
          return left.time - right.time || left.path.localeCompare(right.path, "zh-CN");
        });
      keeperIndex = ranked[0]?.index ?? keeperIndex;
    }
    return group.files
      .filter((_, index) => index !== keeperIndex)
      .map((file) => file.path);
  }

  function applyQuickSelectionToGroup(group, strategy) {
    const nextPaths = collectQuickSelectionPaths(group, strategy);
    const groupPaths = (group?.files || []).map((file) => file.path);
    setSelectedPaths((current) => {
      const outsideGroupPaths = current.filter((path) => !groupPaths.includes(path));
      return dedupePathList([...outsideGroupPaths, ...nextPaths]);
    });
  }

  function applyQuickSelectionToVisibleGroups(strategy) {
    if (!visibleGroups.length) {
      return;
    }
    const visibleGroupPathSet = new Set(visibleGroups.flatMap((group) => group.files.map((file) => file.path)));
    const nextSelectedPaths = visibleGroups.flatMap((group) => collectQuickSelectionPaths(group, strategy));
    setSelectedPaths((current) => {
      const outsideVisiblePaths = current.filter((path) => !visibleGroupPathSet.has(path));
      return dedupePathList([...outsideVisiblePaths, ...nextSelectedPaths]);
    });
  }

  function applyComparedFolderSelection(side) {
    const nextSelectedPaths = groups.flatMap((group) => (
      group.files
        .filter((file) => {
          const [inLeft, inRight] = getComparedFolderSides(file.path, primaryDirectoryPath, compareDirectoryPath);
          return side === "left" ? inLeft : inRight;
        })
        .map((file) => file.path)
    ));
    setSelectedPaths(dedupePathList(nextSelectedPaths));
  }

  return {
    applyComparedFolderSelection,
    applyQuickSelectionToGroup,
    applyQuickSelectionToVisibleGroups,
    clearGroupSelection,
    invertGroupSelection,
    toggleFullGroupSelection,
    toggleSelectedPath
  };
}
