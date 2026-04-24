import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildPreviewURL, cancelDuplicateJob, createDuplicateJob, fetchDuplicateJob, refreshDuplicatePaths, runDuplicateAction, undoDuplicateRenameAction } from "../api/client";
import DuplicateDialogs from "../components/duplicates/DuplicateDialogs";
import DuplicateHeaderActions from "../components/duplicates/DuplicateHeaderActions";
import DuplicateInsightsSidebar from "../components/duplicates/DuplicateInsightsSidebar";
import DuplicatePageFeedback from "../components/duplicates/DuplicatePageFeedback";
import DuplicateResultsColumn from "../components/duplicates/DuplicateResultsColumn";
import DuplicateToolbarSection from "../components/duplicates/DuplicateToolbarSection";
import PreviewDialog from "../components/PreviewDialog";
import Toast from "../components/Toast";
import useDuplicateActionLogs from "../hooks/useDuplicateActionLogs";
import useDuplicateActionConfirm from "../hooks/useDuplicateActionConfirm";
import useDuplicateActionExecution from "../hooks/useDuplicateActionExecution";
import useDuplicateExport from "../hooks/useDuplicateExport";
import useDuplicateGroupVisibility from "../hooks/useDuplicateGroupVisibility";
import useDuplicateHistory from "../hooks/useDuplicateHistory";
import useDuplicateInlineRename from "../hooks/useDuplicateInlineRename";
import useDuplicateJobLifecycle from "../hooks/useDuplicateJobLifecycle";
import useDuplicatePageSetup from "../hooks/useDuplicatePageSetup";
import useDuplicatePicker from "../hooks/useDuplicatePicker";
import useDuplicatePathActions from "../hooks/useDuplicatePathActions";
import useDuplicatePreview from "../hooks/useDuplicatePreview";
import useDuplicateResultViewState from "../hooks/useDuplicateResultViewState";
import useDuplicateScanActions from "../hooks/useDuplicateScanActions";
import useDuplicateSelection from "../hooks/useDuplicateSelection";
import useDuplicateSelectionState from "../hooks/useDuplicateSelectionState";
import useRoots from "../hooks/useRoots";
import useToast from "../hooks/useToast";
import { copyResolvedPath as copyPreferredPath } from "../lib/copyPath";
import { copyText } from "../lib/clipboard";
import { getFileMeta } from "../lib/fileMeta";
import { formatBytes, toBytes } from "../lib/format";
import { useI18n } from "../lib/i18n.jsx";
import { createMemoryStateStore } from "../lib/memoryState";
import { getMediaPreviewMessage, isMediaPreviewSupported } from "../lib/mediaPreview";
import {
  buildDuplicateExportFilename,
  canStartDuplicateScan,
  displayPathName,
  ensureTrailingSlash,
  findSharedFolderPaths as buildSharedFolderPaths,
  normalizeDuplicatePageError,
  normalizePathInput
} from "../lib/duplicatePageUtils";
import {
  applyDuplicateActionResult,
  applyDuplicateRefreshResult,
  applyDuplicateRenameResult,
  buildDuplicateActionLogEntry,
  buildHistoryEntry,
  dedupePathList,
  getKeeperPath,
  remapSelectedFilePath,
  remapSelectedPaths
} from "../lib/duplicateStateTransforms";
import {
  filterDuplicateGroupByScope,
  getComparedFolderSides,
  matchesDuplicateExtensionFilter,
  matchesDuplicateNamingFilter,
  matchesDuplicatePathFilter,
  matchesDuplicateTimeFeatureFilter,
  pathWithinScope
} from "../lib/duplicateFilters";
import {
  compareGroups,
  duplicateBenefitFilterLabel,
  duplicateExtensionFilterLabel,
  duplicateFileTime,
  duplicateGroupSizeFilterLabel,
  duplicateModeLabel,
  duplicateNamingFilterLabel,
  duplicatePathFilterLabel,
  duplicateScopeFilterLabel,
  duplicateSelectedStatusFilterLabel,
  duplicateTimeFeatureFilterLabel,
  formatDate,
  formatDateTime,
  formatDuplicateProgressTitle,
  formatDuplicateRefreshMessage,
  groupSortTime,
  progressTone,
  summarizeByType
} from "../lib/duplicatePresentation";
import { deriveHostPath, findRootForPath, pathLabel } from "../lib/pathUtils";
import { getPreviewKind } from "../lib/previewFile";
import { registerMemoryResetter } from "../lib/runtimeMemory";
import { buildDuplicateGroupDecisionKey } from "../lib/duplicateGroupVisibility";
import { isIgnoredPath, readCopyHostPathSetting, readDuplicateAllowFullSelectionSetting, readDuplicateIgnoreList } from "../lib/settingsStore";
import { releaseRuntimeMemory } from "../api/client";

const TYPE_FILTERS = ["all", "image", "video", "document", "archive", "other"];
const SELECTED_STATUS_FILTERS = ["all", "selected", "unselected"];
const SCOPE_FILTERS = ["all", "sameFolder", "sameParentSubdirs"];
const NAMING_FILTERS = ["all", "sameName", "differentName"];
const EXTENSION_FILTERS = ["all", "sameExtension", "crossExtension"];
const PATH_FILTERS = ["all", "similar", "different"];
const TIME_FEATURE_FILTERS = ["all", "recent", "idle"];
const BENEFIT_FILTERS = [
  { key: "all", minBytes: 0 },
  { key: "100mb", minBytes: 100 * 1024 * 1024 },
  { key: "1gb", minBytes: 1024 * 1024 * 1024 }
];
const GROUP_SIZE_FILTER_OPTIONS = [
  { key: "all", min: 0 },
  { key: "3plus", min: 3 },
  { key: "5plus", min: 5 }
];
const EMPTY_GROUPS = [];
const INITIAL_VISIBLE_GROUPS = 24;
const VISIBLE_GROUPS_STEP = 20;
const DUPLICATE_SCAN_MODES = ["scan", "folders", "file"];
const SORT_OPTIONS = ["timeDesc", "timeAsc", "sizeDesc", "sizeAsc"];
const SIZE_FILTERS = [
  { key: "all", min: 0 },
  { key: "1mb", min: 1 * 1024 * 1024 },
  { key: "10mb", min: 10 * 1024 * 1024 },
  { key: "100mb", min: 100 * 1024 * 1024 },
  { key: "1gb", min: 1024 * 1024 * 1024 }
];
const TIME_FILTERS = [
  { key: "all", maxAgeMs: 0 },
  { key: "7d", maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", maxAgeMs: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", maxAgeMs: 90 * 24 * 60 * 60 * 1000 }
];
const HISTORY_LIMIT = 10;
const UNIT_OPTIONS = ["B", "KB", "MB", "GB"];
const DUPLICATE_ACTIONS = [
  { key: "delete", icon: "delete", labelKey: "actions.removeDuplicates" },
  { key: "rename", icon: "drive_file_rename_outline", labelKey: "actions.renameDuplicates" },
  { key: "hardlink", icon: "link", labelKey: "actions.hardlinkDuplicates" },
  { key: "symlink", icon: "share", labelKey: "actions.symlinkDuplicates" },
  { key: "reflink", icon: "difference", labelKey: "actions.reflinkDuplicates" }
];
const SHARED_FOLDER_CLUSTER_COLORS = ["#0b8a5b", "#8a4fff", "#c76a00", "#0077b6", "#b83280", "#6b8e23"];
const LONG_TOAST_DURATION = 4200;
const ACTION_LOG_LIMIT = 12;

const DEFAULT_DUPLICATE_STATE = {
  form: { mode: "scan", root: "", path: "", comparePath: "", minSizeBytes: "" },
  unit: "KB",
  jobId: "",
  job: null,
  searchQuery: "",
  selectedStatusFilter: "all",
  scopeFilter: "all",
  timeFeatureFilter: "all",
  namingFilter: "all",
  extensionFilter: "all",
  pathFilter: "all",
  groupSizeFilter: "all",
  benefitFilter: "all",
  typeFilter: "all",
  sizeFilter: "all",
  timeFilter: "all",
  sortOrder: "timeDesc",
  selectedFilePath: "",
  selectedPaths: [],
  reflinkedPaths: []
};
const duplicateStateStore = createMemoryStateStore(DEFAULT_DUPLICATE_STATE);
registerMemoryResetter("duplicates-page", () => {
  duplicateStateStore.reset();
});

export default function DuplicatesPage({ embedded = false, initialConfig = null, hideHeader = false, onEmbeddedMetaChange = null }) {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const roots = useRoots();
  const saved = duplicateStateStore.read();
  const [form, setForm] = useState(saved.form);
  const [unit, setUnit] = useState(saved.unit);
  const [jobId, setJobId] = useState(saved.jobId);
  const [job, setJob] = useState(saved.job);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState(saved.searchQuery);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(saved.selectedStatusFilter || "all");
  const [toolbarSearchOpen, setToolbarSearchOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState(saved.scopeFilter || "all");
  const [timeFeatureFilter, setTimeFeatureFilter] = useState(saved.timeFeatureFilter || "all");
  const [namingFilter, setNamingFilter] = useState(saved.namingFilter || "all");
  const [extensionFilter, setExtensionFilter] = useState(saved.extensionFilter || "all");
  const [pathFilter, setPathFilter] = useState(saved.pathFilter || "all");
  const [groupSizeFilter, setGroupSizeFilter] = useState(saved.groupSizeFilter || "all");
  const [benefitFilter, setBenefitFilter] = useState(saved.benefitFilter || "all");
  const [typeFilter, setTypeFilter] = useState(saved.typeFilter);
  const [sizeFilter, setSizeFilter] = useState(saved.sizeFilter);
  const [timeFilter, setTimeFilter] = useState(saved.timeFilter);
  const [sortOrder, setSortOrder] = useState(saved.sortOrder);
  const [selectedFilePath, setSelectedFilePath] = useState(saved.selectedFilePath);
  const [selectedPaths, setSelectedPaths] = useState(saved.selectedPaths);
  const [reflinkedPaths, setReflinkedPaths] = useState(saved.reflinkedPaths);
  const [showInsights, setShowInsights] = useState(false);
  const [dismissedPageError, setDismissedPageError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [openGroupMenuHash, setOpenGroupMenuHash] = useState("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const groupMenuRef = useRef(null);
  const duplicateQueryAppliedRef = useRef(false);

  const rootPaths = useMemo(() => roots.items.map((item) => item?.path).filter(Boolean), [roots.items]);
  const activeRoot = rootPaths.includes(form.root) ? form.root : rootPaths[0] || "";
  const activeRootMeta = useMemo(() => roots.items.find((item) => item?.path === activeRoot) || null, [activeRoot, roots.items]);
  const scanMode = DUPLICATE_SCAN_MODES.includes(form.mode) ? form.mode : "scan";
  const preferHostPath = readCopyHostPathSetting();
  const primaryDirectoryPath = scanMode === "file"
    ? activeRoot
    : (form.path && findRootForPath(rootPaths, form.path) === activeRoot ? form.path : activeRoot);
  const compareDirectoryPath = form.comparePath ? normalizePathInput(form.comparePath) : activeRoot;
  const fileComparePath = normalizePathInput(form.path);
  const activeRootWritable = activeRootMeta?.writable !== false;
  const ignoreList = useMemo(() => readDuplicateIgnoreList(), [roots.items.length]);
  const allowFullGroupSelection = readDuplicateAllowFullSelectionSetting();
  const allGroups = job?.result?.groups ?? EMPTY_GROUPS;
  const hasScanResults = job?.status === "done";
  const menuScopeKey = [activeRoot, form.comparePath, jobId, primaryDirectoryPath, scanMode].join("|");
  const groupDecisionContext = useMemo(() => ({
    root: activeRoot,
    mode: scanMode,
    path: primaryDirectoryPath,
    comparePath: form.comparePath
  }), [activeRoot, form.comparePath, primaryDirectoryPath, scanMode]);
  const {
    closePicker,
    handlePickerBrowsePathChange,
    handlePickerConfirm,
    handlePickerRootChange,
    openPicker,
    pickerBrowsePath,
    pickerDirectories,
    pickerIgnoreList,
    pickerMode,
    pickerOpen,
    pickerRoot,
    pickerSearchPlaceholder,
    pickerSelectedPath,
    pickerTitle
  } = useDuplicatePicker({
    activeRoot,
    compareDirectoryPath,
    fileComparePath,
    ignoreList,
    locale,
    primaryDirectoryPath,
    rootPaths,
    scanMode,
    setForm
  });
  const {
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
  } = useDuplicateGroupVisibility({
    activeRoot,
    comparePath: form.comparePath,
    groupDecisionContext,
    jobId,
    locale,
    normalizePathInput,
    primaryDirectoryPath,
    scanMode,
    setOpenGroupMenuHash,
    toast
  });
  const {
    actionLogFilter,
    actionLogs,
    actionLogsOpen,
    filteredActionLogs,
    setActionLogFilter,
    setActionLogsOpen,
    undoLoading,
    handleActionLogClear,
    handleActionLogDelete,
    handleUndoActionLog,
    recordDuplicateActionLog
  } = useDuplicateActionLogs({
    actionLogLimit: ACTION_LOG_LIMIT,
    activeRoot,
    applyDuplicateRenameResult,
    buildDuplicateActionLogEntry,
    comparePath: form.comparePath,
    getJob: () => job,
    locale,
    longToastDuration: LONG_TOAST_DURATION,
    primaryPath: primaryDirectoryPath,
    requestFailedMessage: t("messages.requestFailed"),
    remapSelectedFilePath,
    runUndoRename: undoDuplicateRenameAction,
    scanMode,
    setError,
    setJob,
    setSelectedFilePath,
    toast
  });
  const {
    appendHistoryEntry,
    handleHistoryClear,
    handleHistoryDelete,
    historyEntries,
    historyLoading,
    historyOpen,
    historyRef,
    restoringHistoryId,
    restoreHistoryEntry,
    setHistoryOpen
  } = useDuplicateHistory({
    getHistoryEntry: (nextJob) => buildHistoryEntry(nextJob, activeRoot, primaryDirectoryPath, form.comparePath, form.minSizeBytes, scanMode),
    historyLimit: HISTORY_LIMIT,
    job,
    requestFailedMessage: t("messages.requestFailed"),
    restoreEntry: (entry) => {
      setJobId("");
      setJob(null);
      setError("");
      resetResultsState();
      setForm({
        mode: entry.mode || entry.result?.mode || "scan",
        root: entry.root || activeRoot,
        path: entry.path || entry.result.path,
        comparePath: entry.comparePath || entry.result.comparePath || "",
        minSizeBytes: entry.minSizeBytes > 0 ? String(entry.minSizeBytes) : ""
      });
      setJobId("");
      setJob({
        jobId: entry.id,
        status: "done",
        result: entry.result,
        createdAt: entry.createdAt || entry.savedAt
      });
      setError("");
      setSelectedPaths([]);
      setReflinkedPaths([]);
    },
    restoreSuccessMessage: t("messages.historyRestored"),
    t,
    toast
  });
  const {
    beginInlineRename,
    cancelInlineRename,
    inlineRenameLoading,
    inlineRenamePath,
    inlineRenameValue,
    setInlineRenameValue,
    submitInlineRename
  } = useDuplicateInlineRename({
    activeRoot,
    applyDuplicateActionResult,
    duplicateActionFailedMessage: t("messages.duplicateActionFailed"),
    duplicateRenameNameRequiredMessage: t("messages.duplicateRenameNameRequired"),
    duplicateRenameNoChangesMessage: t("messages.duplicateRenameNoChanges"),
    getJob: () => job,
    locale,
    longToastDuration: LONG_TOAST_DURATION,
    onRecordActionLog: recordDuplicateActionLog,
    remapSelectedFilePath,
    remapSelectedPaths,
    runDuplicateAction,
    setError,
    setJob,
    setSelectedFilePath,
    setSelectedPaths,
    toast
  });
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const visibleGroupResetKey = [
    benefitFilter,
    deferredSearchQuery,
    extensionFilter,
    groupSizeFilter,
    jobId,
    namingFilter,
    pathFilter,
    scopeFilter,
    selectedStatusFilter,
    sizeFilter,
    timeFilter,
    sortOrder,
    timeFeatureFilter,
    typeFilter
  ].join("|");
  const filteredGroups = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const min = SIZE_FILTERS.find((item) => item.key === sizeFilter)?.min ?? 0;
    const maxAgeMs = TIME_FILTERS.find((item) => item.key === timeFilter)?.maxAgeMs ?? 0;
    const minGroupFiles = GROUP_SIZE_FILTER_OPTIONS.find((item) => item.key === groupSizeFilter)?.min ?? 0;
    const minBenefitBytes = BENEFIT_FILTERS.find((item) => item.key === benefitFilter)?.minBytes ?? 0;
    const now = Date.now();
    const filtered = allGroups
      .map((group) => filterDuplicateGroupByScope(group, scopeFilter))
      .filter(Boolean)
      .filter((group) => {
        const meta = getFileMeta(group.files[0]?.name ?? "", "", false);
        if (typeFilter !== "all" && meta.label.toLowerCase() !== typeFilter) return false;
        if (min > 0 && group.sizeBytes < min) return false;
        if (maxAgeMs > 0 && now - groupSortTime(group) > maxAgeMs) return false;
        if (minGroupFiles > 0 && group.files.length < minGroupFiles) return false;
        if (minBenefitBytes > 0 && (group.wastedBytes || 0) < minBenefitBytes) return false;
        if (!matchesDuplicateTimeFeatureFilter(group, timeFeatureFilter, now)) return false;
        if (!matchesDuplicateNamingFilter(group, namingFilter)) return false;
        if (!matchesDuplicateExtensionFilter(group, extensionFilter)) return false;
        if (!matchesDuplicatePathFilter(group, pathFilter)) return false;
        const groupKey = buildDuplicateGroupDecisionKey({ ...groupDecisionContext, hash: group.hash });
        if (skippedGroupKeySet.has(groupKey) || ignoredGroupKeySet.has(groupKey)) return false;
        return !query || group.files.some((file) => `${file.name} ${file.path}`.toLowerCase().includes(query));
      });
    return filtered;
  }, [allGroups, benefitFilter, deferredSearchQuery, extensionFilter, groupDecisionContext, groupSizeFilter, ignoredGroupKeySet, namingFilter, pathFilter, scopeFilter, sizeFilter, skippedGroupKeySet, timeFeatureFilter, timeFilter, typeFilter]);
  const groups = useMemo(() => {
    const withSelectedStatus = selectedStatusFilter === "all"
      ? filteredGroups
      : filteredGroups.filter((group) => {
          const selectedCount = group.files.reduce((count, file) => count + (selectedPathSet.has(file.path) ? 1 : 0), 0);
          if (selectedStatusFilter === "selected") {
            return selectedCount > 0;
          }
          if (selectedStatusFilter === "unselected") {
            return selectedCount === 0;
          }
          return true;
        });
    return [...withSelectedStatus].sort((left, right) => compareGroups(left, right, sortOrder));
  }, [filteredGroups, selectedPathSet, selectedStatusFilter, sortOrder]);
  const { exporting, handleExportDuplicates } = useDuplicateExport({
    buildDuplicateExportFilename,
    exportCompletedMessage: t("messages.exportCompleted"),
    getKeeperPath,
    groups,
    locale,
    longToastDuration: LONG_TOAST_DURATION,
    requestFailedMessage: t("messages.requestFailed"),
    selectedPathSet,
    t,
    toast
  });
  const resetDuplicateFilters = useCallback(() => {
    setSelectedStatusFilter("all");
    setScopeFilter("all");
    setTimeFeatureFilter("all");
    setNamingFilter("all");
    setExtensionFilter("all");
    setPathFilter("all");
    setGroupSizeFilter("all");
    setBenefitFilter("all");
    setTypeFilter("all");
    setSizeFilter("all");
    setTimeFilter("all");
    setSortOrder("timeDesc");
  }, []);
  const {
    handleHistoryRescan,
    handleRefreshFileStates,
    handleRescanCurrent,
    handleStart,
    startDuplicateScan
  } = useDuplicateScanActions({
    activeRoot,
    appendHistoryEntry,
    applyDuplicateRefreshResult,
    buildHistoryEntry,
    canStartDuplicateScan: canStartDuplicateScan({ scanMode, activeRoot, primaryDirectoryPath, compareDirectoryPath, fileComparePath }),
    compareDirectoryPath,
    createDuplicateJob,
    fileComparePath,
    form,
    formatDuplicateRefreshMessage,
    ignoreList,
    job,
    locale,
    longToastDuration: LONG_TOAST_DURATION,
    onBeforeStart: resetDuplicateFilters,
    primaryDirectoryPath,
    refreshDuplicatePaths,
    scanMode,
    setActionLoading,
    setError,
    setForm,
    setHistoryOpen,
    setJob,
    setJobId,
    setSelectedPaths,
    t,
    toBytes,
    toast,
    unit
  });
  const {
    handleCopy,
    handleCopyGroupPaths,
    resolveDisplayPath
  } = useDuplicatePathActions({
    activeRoot,
    activeRootHostPath: activeRootMeta?.hostPath,
    copyPreferredPath,
    copyText,
    deriveHostPath,
    locale,
    preferHostPath,
    selectedPathSet,
    t,
    toast
  });
  const {
    bulkBarOffset,
    filterBarExpanded,
    filterBarRef,
    loadMoreRef,
    setFilterBarExpanded,
    visibleGroupCount
  } = useDuplicateResultViewState({
    groupsLength: groups.length,
    groupMenuRef,
    hasScanResults,
    initialVisibleGroups: INITIAL_VISIBLE_GROUPS,
    menuScopeKey,
    openGroupMenuHash,
    resetKey: visibleGroupResetKey,
    setOpenGroupMenuHash,
    visibleGroupsStep: VISIBLE_GROUPS_STEP
  });
  const visibleGroups = useMemo(() => groups.slice(0, visibleGroupCount), [groups, visibleGroupCount]);
  const {
    applyComparedFolderSelection,
    applyQuickSelectionToGroup,
    applyQuickSelectionToVisibleGroups,
    clearGroupSelection,
    invertGroupSelection,
    toggleFullGroupSelection,
    toggleSelectedPath
  } = useDuplicateSelection({
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
  });
  const groupFileIndex = useMemo(() => {
    const filePathSet = new Set();
    const fileByPath = new Map();
    let totalFiles = 0;
    let firstFile = null;

    for (const group of groups) {
      for (const file of group.files) {
        if (firstFile == null) {
          firstFile = file;
        }
        filePathSet.add(file.path);
        fileByPath.set(file.path, file);
        totalFiles += 1;
      }
    }

    return {
      fileByPath,
      filePathSet,
      firstFile,
      totalFiles
    };
  }, [groups]);
  const selectionMetrics = useMemo(() => {
    let selectedGroups = 0;
    let hasFullSelectionFlag = false;

    for (const group of groups) {
      let selectedCount = 0;
      for (const file of group.files) {
        if (selectedPathSet.has(file.path)) {
          selectedCount += 1;
        }
      }
      if (selectedCount > 0) {
        selectedGroups += 1;
      }
      if (group.files.length > 0 && selectedCount === group.files.length) {
        hasFullSelectionFlag = true;
      }
    }

    return {
      hasFullSelection: hasFullSelectionFlag,
      selectedGroups
    };
  }, [groups, selectedPathSet]);
  const allGroupFilePathSet = useMemo(() => {
    const filePathSet = new Set();
    for (const group of allGroups) {
      for (const file of group.files || []) {
        filePathSet.add(file.path);
      }
    }
    return filePathSet;
  }, [allGroups]);
  const selectedFile = groupFileIndex.fileByPath.get(selectedFilePath) || groupFileIndex.firstFile || null;
  const reflinkedPathSet = useMemo(() => new Set(reflinkedPaths), [reflinkedPaths]);
  const selectionSummary = useMemo(
    () => ({ files: selectedPaths.length, groups: selectionMetrics.selectedGroups }),
    [selectionMetrics.selectedGroups, selectedPaths.length]
  );
  const hasFullSelection = selectionMetrics.hasFullSelection;
  const previewKind = getPreviewKind(selectedFile?.name || "");
  const previewRoot = selectedFile ? (findRootForPath(rootPaths, selectedFile.path) || activeRoot) : activeRoot;
  const previewURL = selectedFile ? buildPreviewURL(previewRoot, selectedFile.path) : "";
  const mediaPreviewSupported = selectedFile ? isMediaPreviewSupported(selectedFile.name, previewKind) : true;
  const mediaPreviewMessage = selectedFile ? getMediaPreviewMessage(selectedFile.name, previewKind, locale) : "";
  const {
    previewError,
    previewLoading,
    resetPreviewState,
    setShowPreviewDetails,
    showPreviewDetails,
    textPreview
  } = useDuplicatePreview({
    previewKind,
    previewRoot,
    selectedFile
  });
  const stats = useMemo(
    () => groups.reduce((summary, group) => ({ totalGroups: summary.totalGroups + 1, totalFiles: summary.totalFiles + group.fileCount, totalWastedBytes: summary.totalWastedBytes + group.wastedBytes }), { totalGroups: 0, totalFiles: 0, totalWastedBytes: 0 }),
    [groups]
  );
  const insightStats = useMemo(() => summarizeByType(groups), [groups]);
  const pageError = normalizeDuplicatePageError(roots.error || error || (job?.status === "error" ? job.error : ""), t);
  const showDismissiblePageError = Boolean(pageError) && pageError !== dismissedPageError;
  const showIdleEmptyState = !job && !roots.loading && !pageError && !restoringHistoryId;
  const hasCompletedResults = job?.status === "done" && allGroups.length > 0;
  const hasVisibleResults = groups.length > 0;
  const findSharedFolderPaths = useCallback(
    (files, resolveDisplayPath) => buildSharedFolderPaths(files, resolveDisplayPath, SHARED_FOLDER_CLUSTER_COLORS),
    []
  );
  const resetResultsState = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setSizeFilter("all");
    setTimeFilter("all");
    setSortOrder("timeDesc");
    setSelectedFilePath("");
    setSelectedPaths([]);
    setReflinkedPaths([]);
    setPreviewDialogOpen(false);
    resetPreviewState();
  };
  const { handleClearResults } = useDuplicateJobLifecycle({
    cancelDuplicateJob,
    fetchDuplicateJob,
    job,
    jobId,
    releaseJobMemory: async (activeJobId) => releaseRuntimeMemory({ duplicateJobId: activeJobId }),
    resetResultsState,
    setError,
    setJob,
    setJobId
  });

  useEffect(() => {
    duplicateStateStore.write({ form, unit, jobId, job, searchQuery, selectedStatusFilter, scopeFilter, timeFeatureFilter, namingFilter, extensionFilter, pathFilter, groupSizeFilter, benefitFilter, typeFilter, sizeFilter, timeFilter, sortOrder, selectedFilePath, selectedPaths, reflinkedPaths });
  }, [benefitFilter, extensionFilter, form, groupSizeFilter, job, jobId, namingFilter, pathFilter, reflinkedPaths, scopeFilter, searchQuery, selectedFilePath, selectedPaths, selectedStatusFilter, sizeFilter, sortOrder, timeFeatureFilter, timeFilter, typeFilter, unit]);

  useEffect(() => {
    if (pageError && pageError !== dismissedPageError) {
      setDismissedPageError("");
    }
  }, [dismissedPageError, pageError]);

  useEffect(() => {
    if (!embedded || typeof onEmbeddedMetaChange !== "function") {
      return;
    }
    onEmbeddedMetaChange({
      job,
      error,
      stats,
      hasScanResults,
      handleClearResults,
      handleRescanCurrent,
      handleRefreshFileStates
    });
  }, [embedded, error, hasScanResults, job, onEmbeddedMetaChange, stats]);

  useDuplicatePageSetup({
    activeRoot,
    compareDirectoryPath,
    duplicateQueryAppliedRef,
    duplicateScanModes: DUPLICATE_SCAN_MODES,
    embedded,
    ignoreList,
    initialConfig,
    isIgnoredPath,
    normalizePathInput,
    primaryDirectoryPath,
    rootPaths,
    rootsLoading: roots.loading,
    scanMode,
    searchParams,
    setForm,
    setSearchParams,
    startDuplicateScan
  });

  useDuplicateSelectionState({
    allGroupFilePathSet,
    allowFullGroupSelection,
    currentGroupFilePathSet: groupFileIndex.filePathSet,
    groups,
    selectedFilePath,
    setSelectedFilePath,
    setSelectedPaths
  });
  const { handleDuplicateAction } = useDuplicateActionExecution({
    activeRoot,
    appendHistoryEntry,
    buildHistoryEntryArgs: () => [activeRoot, primaryDirectoryPath, form.comparePath, form.minSizeBytes, scanMode],
    getJob: () => job,
    groups,
    locale,
    longToastDuration: LONG_TOAST_DURATION,
    recordDuplicateActionLog,
    runDuplicateAction,
    selectedPathSet,
    selectedPaths,
    setActionLoading,
    setConfirmState,
    setError,
    setJob,
    setReflinkedPaths,
    setSelectedFilePath,
    setSelectedPaths,
    t,
    toast
  });
  const {
    confirmMessage,
    confirmTitle,
    handleCloseConfirm,
    handleConfirmAction,
    handleConfirmStateChange,
    handlePreviewAction,
    requestDuplicateAction
  } = useDuplicateActionConfirm({
    activeRootWritable,
    confirmState,
    duplicateKeeperRequiredForLinkMessage: t("messages.duplicateKeeperRequiredForLink"),
    duplicateSelectionEmptyMessage: t("messages.duplicateSelectionEmpty"),
    handleDuplicateAction,
    getKeeperPath,
    groups,
    locale,
    selectedPathSet,
    selectedPaths,
    setConfirmState,
    t,
    toast
  });

  return (
    <div className="page-stack">
      {!embedded ? (
        <DuplicateHeaderActions
          canStart={canStartDuplicateScan({ scanMode, activeRoot, primaryDirectoryPath, compareDirectoryPath, fileComparePath })}
          error={error}
          exporting={exporting}
          groupsLength={groups.length}
          handleClearResults={handleClearResults}
          handleExportDuplicates={handleExportDuplicates}
          handleHistoryClear={handleHistoryClear}
          handleHistoryDelete={handleHistoryDelete}
          handleHistoryRescan={handleHistoryRescan}
          handleRefreshFileStates={handleRefreshFileStates}
          handleRescanCurrent={handleRescanCurrent}
          handleStart={handleStart}
          historyEntries={historyEntries}
          historyLoading={historyLoading}
          historyLimit={HISTORY_LIMIT}
          historyOpen={historyOpen}
          historyRef={historyRef}
          job={job}
          locale={locale}
          onOpenActionLogs={() => setActionLogsOpen(true)}
          restoringHistoryId={restoringHistoryId}
          restoreHistoryEntry={restoreHistoryEntry}
          setHistoryOpen={setHistoryOpen}
          showFindButton
          showHistoryMenu
          showRefreshListState
          t={t}
        />
      ) : !hideHeader ? (
        <DuplicateHeaderActions
          canStart={false}
          error={error}
          exporting={exporting}
          groupsLength={groups.length}
          handleClearResults={handleClearResults}
          handleExportDuplicates={handleExportDuplicates}
          handleHistoryClear={handleHistoryClear}
          handleHistoryDelete={handleHistoryDelete}
          handleHistoryRescan={handleHistoryRescan}
          handleRefreshFileStates={handleRefreshFileStates}
          handleRescanCurrent={handleRescanCurrent}
          handleStart={handleStart}
          historyEntries={historyEntries}
          historyLimit={HISTORY_LIMIT}
          historyOpen={historyOpen}
          historyRef={historyRef}
          job={job}
          locale={locale}
          onOpenActionLogs={() => setActionLogsOpen(true)}
          restoringHistoryId={restoringHistoryId}
          restoreHistoryEntry={restoreHistoryEntry}
          setHistoryOpen={setHistoryOpen}
          showFindButton={false}
          showHistoryMenu={false}
          showRefreshListState={false}
          t={t}
        />
      ) : null}

      <DuplicateToolbarSection
        activeRoot={activeRoot}
        compareDirectoryPath={compareDirectoryPath}
        duplicateModeLabel={duplicateModeLabel}
        duplicateScanModes={DUPLICATE_SCAN_MODES}
        fileComparePath={fileComparePath}
        form={form}
        hasScanResults={hasScanResults}
        hasToolbarSearch={toolbarSearchOpen && hasScanResults ? true : (embedded ? hasScanResults : false)}
        locale={locale}
        onChangeSearchQuery={setSearchQuery}
        onChangeUnit={setUnit}
        onCloseSearch={() => {
          setSearchQuery("");
          setToolbarSearchOpen(false);
        }}
        onOpenPicker={openPicker}
        onOpenSearch={() => setToolbarSearchOpen(true)}
        onSetForm={setForm}
        pathLabel={pathLabel}
        primaryDirectoryPath={primaryDirectoryPath}
        resolveDisplayPath={resolveDisplayPath}
        scanMode={scanMode}
        searchQuery={searchQuery}
        showSearchClose={!embedded && toolbarSearchOpen && hasScanResults}
        t={t}
        unit={unit}
        unitOptions={UNIT_OPTIONS}
      />

      <DuplicatePageFeedback
        formatDuplicateProgressTitle={formatDuplicateProgressTitle}
        hasScanResults={hasScanResults}
        job={job}
        locale={locale}
        onDismissError={() => setDismissedPageError(pageError)}
        pageError={pageError}
        restoringHistoryId={restoringHistoryId}
        rootsLoading={roots.loading}
        showDismissiblePageError={showDismissiblePageError}
        showIdleEmptyState={showIdleEmptyState}
        t={t}
      />

      {hasScanResults ? (
        <section className="duplicates-layout">
          <DuplicateResultsColumn
            actionLoading={actionLoading}
            activeRootWritable={activeRootWritable}
            allowFullGroupSelection={allowFullGroupSelection}
            applyComparedFolderSelection={applyComparedFolderSelection}
            applyQuickSelectionToGroup={applyQuickSelectionToGroup}
            applyQuickSelectionToVisibleGroups={applyQuickSelectionToVisibleGroups}
            beginInlineRename={beginInlineRename}
            benefitFilter={benefitFilter}
            benefitFilters={BENEFIT_FILTERS}
            bulkBarOffset={bulkBarOffset}
            cancelInlineRename={cancelInlineRename}
            clearGroupSelection={clearGroupSelection}
            displayPathName={displayPathName}
            duplicateActions={DUPLICATE_ACTIONS}
            duplicateBenefitFilterLabel={duplicateBenefitFilterLabel}
            duplicateExtensionFilterLabel={duplicateExtensionFilterLabel}
            duplicateGroupSizeFilterLabel={duplicateGroupSizeFilterLabel}
            duplicateNamingFilterLabel={duplicateNamingFilterLabel}
            duplicatePathFilterLabel={duplicatePathFilterLabel}
            duplicateScopeFilterLabel={duplicateScopeFilterLabel}
            duplicateSelectedStatusFilterLabel={duplicateSelectedStatusFilterLabel}
            duplicateTimeFeatureFilterLabel={duplicateTimeFeatureFilterLabel}
            ensureTrailingSlash={ensureTrailingSlash}
            extensionFilter={extensionFilter}
            extensionFilters={EXTENSION_FILTERS}
            filterBarExpanded={filterBarExpanded}
            filterBarRef={filterBarRef}
            findSharedFolderPaths={findSharedFolderPaths}
            formatBytes={formatBytes}
            formatDate={formatDate}
            getKeeperPath={getKeeperPath}
            groupMenuRef={groupMenuRef}
            groupSizeFilter={groupSizeFilter}
            groupSizeFilterOptions={GROUP_SIZE_FILTER_OPTIONS}
            groups={groups}
            handleCopyGroupPaths={handleCopyGroupPaths}
            handleIgnoreGroup={handleIgnoreGroup}
            handleSkipGroup={handleSkipGroup}
            hasCompletedResults={hasCompletedResults}
            hasVisibleResults={hasVisibleResults}
            ignoredGroupEntriesForView={ignoredGroupEntriesForView}
            inlineRenameLoading={inlineRenameLoading}
            inlineRenamePath={inlineRenamePath}
            inlineRenameValue={inlineRenameValue}
            invertGroupSelection={invertGroupSelection}
            loadMoreRef={loadMoreRef}
            locale={locale}
            namingFilter={namingFilter}
            namingFilters={NAMING_FILTERS}
            onClearSelectedPaths={() => setSelectedPaths([])}
            onClearSkippedGroups={handleClearSkippedGroups}
            onSetBenefitFilter={setBenefitFilter}
            onSetExtensionFilter={setExtensionFilter}
            onSetFilterBarExpanded={setFilterBarExpanded}
            onSetGroupSizeFilter={setGroupSizeFilter}
            onSetNamingFilter={setNamingFilter}
            onSetPathFilter={setPathFilter}
            onResetFilters={resetDuplicateFilters}
            onSetScopeFilter={setScopeFilter}
            onSetSelectedStatusFilter={setSelectedStatusFilter}
            onSetSizeFilter={setSizeFilter}
            onSetSortOrder={setSortOrder}
            onSetTimeFeatureFilter={setTimeFeatureFilter}
            onSetTimeFilter={setTimeFilter}
            onSetTypeFilter={setTypeFilter}
            openGroupMenuHash={openGroupMenuHash}
            pathFilter={pathFilter}
            pathFilters={PATH_FILTERS}
            reflinkedPathSet={reflinkedPathSet}
            requestDuplicateAction={requestDuplicateAction}
            resolveDisplayPath={resolveDisplayPath}
            scanMode={scanMode}
            scopeFilter={scopeFilter}
            scopeFilters={SCOPE_FILTERS}
            selectedFilePath={selectedFile?.path || ""}
            selectedPathSet={selectedPathSet}
            selectedPaths={selectedPaths}
            selectedStatusFilter={selectedStatusFilter}
            selectedStatusFilters={SELECTED_STATUS_FILTERS}
            selectionSummary={selectionSummary}
            setInlineRenameValue={setInlineRenameValue}
            setOpenGroupMenuHash={setOpenGroupMenuHash}
            setSelectedFilePath={setSelectedFilePath}
            sizeFilter={sizeFilter}
            sizeFilters={SIZE_FILTERS}
            skippedGroupKeys={skippedGroupKeys}
            sortOptions={SORT_OPTIONS}
            sortOrder={sortOrder}
            stats={stats}
            submitInlineRename={submitInlineRename}
            t={t}
            timeFeatureFilter={timeFeatureFilter}
            timeFeatureFilters={TIME_FEATURE_FILTERS}
            timeFilter={timeFilter}
            timeFilters={TIME_FILTERS}
            toast={toast}
            toggleFullGroupSelection={toggleFullGroupSelection}
            toggleSelectedPath={toggleSelectedPath}
            typeFilter={typeFilter}
            typeFilters={TYPE_FILTERS}
            visibleGroupCount={visibleGroupCount}
            visibleGroups={visibleGroups}
          />

          {hasScanResults ? (
            <DuplicateInsightsSidebar
              formatBytes={formatBytes}
              formatDateTime={formatDateTime}
              handleClearIgnoredGroupsInView={handleClearIgnoredGroupsInView}
              handleCopy={handleCopy}
              handleRemoveIgnoredGroup={handleRemoveIgnoredGroup}
              hasCompletedResults={hasCompletedResults}
              ignoredGroupEntriesForView={ignoredGroupEntriesForView}
              ignoredGroupsExpanded={ignoredGroupsExpanded}
              insightStats={insightStats}
              locale={locale}
              mediaPreviewMessage={mediaPreviewMessage}
              mediaPreviewSupported={mediaPreviewSupported}
              onExpandPreview={() => setPreviewDialogOpen(true)}
              previewError={previewError}
              previewKind={previewKind}
              previewLoading={previewLoading}
              previewURL={previewURL}
              progressTone={progressTone}
              resolveDisplayPath={resolveDisplayPath}
              selectedFile={selectedFile}
              setIgnoredGroupsExpanded={setIgnoredGroupsExpanded}
              setShowInsights={setShowInsights}
              setShowPreviewDetails={setShowPreviewDetails}
              showInsights={showInsights}
              showPreviewDetails={showPreviewDetails}
              t={t}
              textPreview={textPreview}
            />
          ) : null}
        </section>
      ) : null}
      <PreviewDialog
        item={selectedFile}
        locale={locale}
        mediaPreviewMessage={mediaPreviewMessage}
        mediaPreviewSupported={mediaPreviewSupported}
        onClose={() => setPreviewDialogOpen(false)}
        open={previewDialogOpen}
        previewKind={previewKind}
        previewRoot={previewRoot}
      />
      <DuplicateDialogs
        actionLogFilter={actionLogFilter}
        actionLogs={actionLogs}
        actionLogsOpen={actionLogsOpen}
        confirmMessage={confirmMessage}
        confirmState={confirmState}
        directories={pickerDirectories}
        filteredActionLogs={filteredActionLogs}
        handlePickerConfirm={handlePickerConfirm}
        hasFullSelection={hasFullSelection}
        locale={locale}
        onChangeActionLogFilter={setActionLogFilter}
        onChangeConfirmState={handleConfirmStateChange}
        onClearActionLogs={handleActionLogClear}
        onCloseActionLogs={() => setActionLogsOpen(false)}
        onCloseConfirm={handleCloseConfirm}
        onClosePicker={closePicker}
        onConfirmAction={handleConfirmAction}
        onDeleteActionLog={handleActionLogDelete}
        onPickerBrowsePathChange={handlePickerBrowsePathChange}
        onPickerRootChange={handlePickerRootChange}
        onPreviewAction={handlePreviewAction}
        onUndoActionLog={handleUndoActionLog}
        openPicker={pickerOpen}
        pickerBrowsePath={pickerBrowsePath}
        pickerMode={pickerMode}
        pickerRoot={pickerRoot}
        pickerSelectedPath={pickerSelectedPath}
        pickerTitle={pickerTitle}
        roots={roots.items}
        searchPlaceholder={pickerSearchPlaceholder}
        selectedFileCount={selectedPaths.length}
        selectionSummary={selectionSummary}
        t={t}
        title={confirmTitle}
        undoLoading={undoLoading}
      />
      <Toast message={toast.message} />
    </div>
  );
}

