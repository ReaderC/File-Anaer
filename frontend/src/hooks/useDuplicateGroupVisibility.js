import { useEffect, useMemo, useState } from "react";
import { buildDuplicateGroupDecisionKey, readDuplicateIgnoredGroups, writeDuplicateIgnoredGroups } from "../lib/duplicateGroupVisibility";

export default function useDuplicateGroupVisibility({
  activeRoot,
  comparePath,
  groupDecisionContext,
  jobId,
  locale,
  normalizePathInput,
  primaryDirectoryPath,
  scanMode,
  setOpenGroupMenuHash,
  toast
}) {
  const [ignoredGroupsExpanded, setIgnoredGroupsExpanded] = useState(false);
  const [skippedGroupKeys, setSkippedGroupKeys] = useState([]);
  const [ignoredGroups, setIgnoredGroups] = useState(() => readDuplicateIgnoredGroups());

  const skippedGroupKeySet = useMemo(() => new Set(skippedGroupKeys), [skippedGroupKeys]);
  const ignoredGroupKeySet = useMemo(() => new Set(ignoredGroups.map((item) => item.key)), [ignoredGroups]);
  const ignoredGroupEntriesForView = useMemo(
    () => ignoredGroups.filter((item) => item.root === activeRoot && item.mode === scanMode && normalizePathInput(item.path) === normalizePathInput(primaryDirectoryPath) && normalizePathInput(item.comparePath) === normalizePathInput(comparePath)),
    [activeRoot, comparePath, ignoredGroups, normalizePathInput, primaryDirectoryPath, scanMode]
  );

  useEffect(() => {
    setSkippedGroupKeys([]);
  }, [activeRoot, comparePath, jobId, primaryDirectoryPath, scanMode]);

  function groupDecisionKey(hash) {
    return buildDuplicateGroupDecisionKey({ ...groupDecisionContext, hash });
  }

  function handleSkipGroup(group) {
    const key = groupDecisionKey(group.hash);
    setSkippedGroupKeys((current) => dedupePathList([...current, key]));
    setOpenGroupMenuHash("");
    toast.showToast(locale === "en" ? "Skipped this group for the current view." : "已跳过当前组，仅对本次视图生效。");
  }

  function handleIgnoreGroup(group) {
    const key = groupDecisionKey(group.hash);
    const entry = {
      key,
      hash: group.hash,
      name: group.files?.[0]?.name || group.hash,
      root: activeRoot,
      mode: scanMode,
      path: primaryDirectoryPath,
      comparePath,
      savedAt: new Date().toISOString()
    };
    const nextEntries = dedupeIgnoredGroupEntries([...ignoredGroups, entry]);
    setIgnoredGroups(nextEntries);
    writeDuplicateIgnoredGroups(nextEntries);
    setSkippedGroupKeys((current) => current.filter((item) => item !== key));
    setOpenGroupMenuHash("");
    toast.showToast(locale === "en" ? "This group is now ignored." : "当前组已加入忽略列表。");
  }

  function handleRemoveIgnoredGroup(key) {
    const nextEntries = ignoredGroups.filter((item) => item.key !== key);
    setIgnoredGroups(nextEntries);
    writeDuplicateIgnoredGroups(nextEntries);
    toast.showToast(locale === "en" ? "Ignored group restored." : "已恢复被忽略的分组。");
  }

  function handleClearSkippedGroups() {
    setSkippedGroupKeys([]);
  }

  function handleClearIgnoredGroupsInView() {
    const nextEntries = ignoredGroups.filter((item) => !ignoredGroupEntriesForView.some((entry) => entry.key === item.key));
    setIgnoredGroups(nextEntries);
    writeDuplicateIgnoredGroups(nextEntries);
    toast.showToast(locale === "en" ? "Ignored groups in this view were restored." : "当前视图中的忽略分组已恢复显示。");
  }

  return {
    ignoredGroupEntriesForView,
    ignoredGroupKeySet,
    ignoredGroupsExpanded,
    setIgnoredGroupsExpanded,
    skippedGroupKeySet,
    skippedGroupKeys,
    handleClearIgnoredGroupsInView,
    handleClearSkippedGroups,
    handleIgnoreGroup,
    handleRemoveIgnoredGroup,
    handleSkipGroup
  };
}

function dedupePathList(items) {
  return [...new Set(items.filter(Boolean))];
}

function dedupeIgnoredGroupEntries(entries) {
  const seen = new Set();
  return (entries || []).filter((item) => {
    if (!item?.key || seen.has(item.key)) {
      return false;
    }
    seen.add(item.key);
    return true;
  });
}
