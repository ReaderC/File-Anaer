import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildPreviewURL, fetchDirectories as fetchDirectoryEntries, fetchTextPreview, runSearch } from "../api/client";
import ActionButton from "../components/ActionButton";
import ArchivePreviewList from "../components/ArchivePreviewList";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilePickerDialog from "../components/FilePickerDialog";
import FilterField from "../components/FilterField";
import Icon from "../components/Icon";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import PreviewDialog from "../components/PreviewDialog";
import SelectMenu from "../components/SelectMenu";
import TextPreviewContent from "../components/TextPreviewContent";
import Toast from "../components/Toast";
import useDirectories from "../hooks/useDirectories";
import useRoots from "../hooks/useRoots";
import useToast from "../hooks/useToast";
import { copyResolvedPath as copyPreferredPath } from "../lib/copyPath";
import { downloadTextFile, toDelimitedText } from "../lib/export";
import { formatBytes, toBytes } from "../lib/format";
import { useI18n } from "../lib/i18n.jsx";
import { createMemoryStateStore } from "../lib/memoryState";
import { getMediaPreviewMessage, isMediaPreviewSupported } from "../lib/mediaPreview";
import { deriveHostPath, findRootForPath, pathLabel } from "../lib/pathUtils";
import { getExtensionLabel, getPreviewKind, previewKindLabel } from "../lib/previewFile";
import { registerMemoryResetter } from "../lib/runtimeMemory";
import {
  persistSettingsToServer,
  readCopyHostPathSetting,
  isIgnoredPath,
  readSearchHiddenSetting,
  readSearchIgnoreList,
  readSearchPageSizeSetting,
  writeSearchPageSizeSetting
} from "../lib/settingsStore";

const SEARCH_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
const SEARCH_PAGE_SIZE_MENU_OPTIONS = SEARCH_PAGE_SIZE_OPTIONS.map((value) => ({ value, label: String(value) }));
const SEARCH_UNIT_OPTIONS = [
  { value: "B", label: "B" },
  { value: "KB", label: "KB" },
  { value: "MB", label: "MB" },
  { value: "GB", label: "GB" }
];
const DEFAULT_SEARCH_STATE = {
  form: {
    root: "",
    path: "",
    query: "",
    extensions: "",
    sizeMin: "",
    sizeMax: "",
    modifiedAfter: "",
    modifiedBefore: "",
    limit: 50,
    offset: 0
  },
  selectedRoots: [],
  units: {
    sizeMin: "KB",
    sizeMax: "KB"
  },
  resultState: { loading: false, error: "", result: null },
  sortBy: "size",
  sortDir: "desc",
  page: 0
};

const searchStateStore = createMemoryStateStore(DEFAULT_SEARCH_STATE);
registerMemoryResetter("search-page", () => {
  searchStateStore.reset();
});

export default function SearchPage() {
  const { t, locale } = useI18n();
  const roots = useRoots();
  const initialSearchState = useMemo(() => searchStateStore.read(), []);
  const [form, setForm] = useState(() => ({
    ...initialSearchState.form,
    limit: normalizeSearchPageSize(initialSearchState.form?.limit)
  }));
  const [selectedRoots, setSelectedRoots] = useState(() => initialSearchState.selectedRoots || []);
  const [units, setUnits] = useState(() => initialSearchState.units);
  const [state, setState] = useState(() => initialSearchState.resultState);
  const [sortBy, setSortBy] = useState(() => initialSearchState.sortBy);
  const [sortDir, setSortDir] = useState(() => initialSearchState.sortDir);
  const [page, setPage] = useState(() => initialSearchState.page);
  const [pageInput, setPageInput] = useState(() => String(initialSearchState.page + 1));
  const [pickerState, setPickerState] = useState(null);
  const [rootMenuOpen, setRootMenuOpen] = useState(false);
  const [selectedResultPath, setSelectedResultPath] = useState("");
  const [textPreview, setTextPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rootMenuRef = useRef(null);
  const rootMenuPopoverRef = useRef(null);
  const [rootMenuStyle, setRootMenuStyle] = useState(null);

  const rootPaths = useMemo(
    () => roots.items.map((item) => item?.path).filter(Boolean),
    [roots.items]
  );
  const rootItemsByPath = useMemo(
    () => new Map(roots.items.filter((item) => item?.path).map((item) => [item.path, item])),
    [roots.items]
  );
  const activeRoot = rootPaths.includes(form.root) ? form.root : rootPaths[0] || "";
  const activePath = form.path && findRootForPath(rootPaths, form.path) === activeRoot ? form.path : activeRoot;
  const effectiveSelectedRoots = useMemo(
    () => normalizeSelectedRoots(selectedRoots, rootPaths, activeRoot),
    [activeRoot, rootPaths, selectedRoots]
  );
  const isMultiRootSearch = effectiveSelectedRoots.length > 1;
  const pickerRoot = pickerState?.root || activeRoot;
  const pickerBrowsePath = pickerState?.browsePath || activePath || activeRoot;
  const pickerDirectories = useDirectories(pickerRoot, pickerBrowsePath);
  const toast = useToast();
  const searchIgnoreList = useMemo(() => readSearchIgnoreList(), [roots.items.length]);
  const preferHostPath = readCopyHostPathSetting();
  const handleCopyPath = useCallback(async (path, hostPath) => {
    const itemRoot = findRootForPath(rootPaths, path) || activeRoot;
    const itemRootMeta = rootItemsByPath.get(itemRoot) || null;
    await copyPreferredPath(path, hostPath, toast.showToast, t, deriveHostPath(path, itemRoot, itemRootMeta?.hostPath));
  }, [activeRoot, rootItemsByPath, rootPaths, t, toast.showToast]);
  const searchColumns = useMemo(() => [
    { key: "name", label: t("labels.fileNamePath"), sortable: true, sortKey: "name" },
    { key: "sizeBytes", label: t("labels.size"), sortable: true, sortKey: "size" },
    { key: "extension", label: t("labels.type"), sortable: true, sortKey: "type" },
    { key: "modifiedAt", label: t("labels.modified"), sortable: true, sortKey: "date" },
    {
      key: "action",
      label: t("labels.action"),
      render: (_value, row) => (
        <button
          type="button"
          className="inline-copy-button"
          onClick={(event) => {
            event.stopPropagation();
            handleCopyPath(row.path, row.hostPath);
          }}
        >
          {t("actions.copyPath")}
        </button>
      )
    }
  ], [handleCopyPath, t]);

  const sizeLabel = locale === "en" ? "Size" : "大小";
  const minSizeLabel = `${locale === "en" ? "Min" : "最小"}${sizeLabel}`;
  const maxSizeLabel = `${locale === "en" ? "Max" : "最大"}${sizeLabel}`;
  const searchRootsLabel = locale === "en" ? "Mounted Roots" : "搜索挂载目录";
  const multiRootPathHint = locale === "en"
    ? `${effectiveSelectedRoots.length} mounted roots selected. Search will run from each root.`
    : `已选择 ${effectiveSelectedRoots.length} 个挂载目录，将直接搜索各根目录。`;
  const searchRootsSummary = formatSearchRootsSummary(effectiveSelectedRoots, locale);
  const truncationMessage = buildSearchTruncationMessage(state.result, locale);

  useEffect(() => {
    searchStateStore.write({
      form,
      selectedRoots,
      units,
      resultState: {
        ...state,
        loading: false
      },
      sortBy,
      sortDir,
      page
    });
  }, [form, selectedRoots, units, state, sortBy, sortDir, page]);

  useEffect(() => {
    const preferredPageSize = readSearchPageSizeSetting();
    setForm((current) => {
      if (current.limit === preferredPageSize) {
        return current;
      }
      return {
        ...current,
        limit: preferredPageSize
      };
    });
  }, []);

  useEffect(() => {
    if (activePath && isIgnoredPath(activePath, searchIgnoreList)) {
      setForm((current) => ({ ...current, root: activeRoot, path: activeRoot }));
    }
  }, [activePath, activeRoot, searchIgnoreList]);

  useEffect(() => {
    if (!rootPaths.length) {
      return;
    }
    if (!rootPaths.includes(form.root) || !form.path || findRootForPath(rootPaths, form.path) !== form.root) {
      const nextRoot = rootPaths[0];
      setForm((current) => ({ ...current, root: nextRoot, path: nextRoot }));
    }
  }, [form.path, form.root, rootPaths]);

  useEffect(() => {
    if (!rootPaths.length) {
      if (selectedRoots.length) {
        setSelectedRoots([]);
      }
      return;
    }
    const normalized = normalizeSelectedRoots(selectedRoots, rootPaths, activeRoot);
    if (!normalized.length) {
      setSelectedRoots([]);
      return;
    }
    if (!samePathList(normalized, selectedRoots)) {
      setSelectedRoots(normalized);
    }
  }, [activeRoot, rootPaths, selectedRoots]);

  useEffect(() => {
    if (rootPaths.length <= 1 && rootMenuOpen) {
      setRootMenuOpen(false);
    }
  }, [rootMenuOpen, rootPaths.length]);

  useEffect(() => {
    function handlePointer(event) {
      if (rootMenuRef.current?.contains(event.target) || rootMenuPopoverRef.current?.contains(event.target)) {
        return;
      }
      setRootMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  useLayoutEffect(() => {
    if (!rootMenuOpen || !rootMenuRef.current) {
      return;
    }
    const updatePosition = () => {
      const rect = rootMenuRef.current.getBoundingClientRect();
      setRootMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 260)
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [rootMenuOpen]);

  useEffect(() => {
    if (effectiveSelectedRoots.length !== 1) {
      return;
    }
    const nextRoot = effectiveSelectedRoots[0];
    if (!nextRoot || nextRoot === activeRoot) {
      return;
    }
    setForm((current) => ({
      ...current,
      root: nextRoot,
      path: nextRoot
    }));
  }, [activeRoot, effectiveSelectedRoots]);

  const baseSearchPayload = useMemo(() => ({
    root: activeRoot,
    roots: isMultiRootSearch ? effectiveSelectedRoots : [],
    path: activePath,
    query: form.query,
    extensions: form.extensions.split(",").map((item) => item.trim()).filter(Boolean),
    ignore: searchIgnoreList,
    includeHidden: readSearchHiddenSetting(),
    sizeMin: toBytes(form.sizeMin, units.sizeMin),
    sizeMax: toBytes(form.sizeMax, units.sizeMax),
    modifiedAfter: form.modifiedAfter ? new Date(form.modifiedAfter).toISOString() : "",
    modifiedBefore: form.modifiedBefore ? new Date(form.modifiedBefore).toISOString() : ""
  }), [
    activePath,
    activeRoot,
    effectiveSelectedRoots,
    form.extensions,
    form.modifiedAfter,
    form.modifiedBefore,
    form.query,
    form.sizeMax,
    form.sizeMin,
    isMultiRootSearch,
    searchIgnoreList,
    units.sizeMax,
    units.sizeMin
  ]);

  const buildSearchPayload = useCallback((pageNumber = 0) => {
    const pageSize = normalizeSearchPageSize(form.limit);
    return {
      ...baseSearchPayload,
      limit: pageSize,
      offset: Math.max(pageNumber, 0) * pageSize,
      sortBy,
      sortDir
    };
  }, [baseSearchPayload, form.limit, sortBy, sortDir]);

  const fetchSearchPage = useCallback(async (pageNumber = 0, { announceTruncation = false } = {}) => {
    const payload = await runSearch(buildSearchPayload(pageNumber));
    setState({ loading: false, error: "", result: payload });
    setForm((current) => ({
      ...current,
      limit: normalizeSearchPageSize(current.limit),
      offset: payload?.offset || 0
    }));
    setPage(pageNumber);
    if (announceTruncation && payload?.truncated) {
      toast.showToast(buildSearchTruncationMessage(payload, locale), 7000);
    }
    return payload;
  }, [buildSearchPayload, locale, toast.showToast]);

  async function handleSearch() {
    if (!activeRoot || !activePath) {
      setState({ loading: false, error: roots.error || t("messages.loadingData"), result: null });
      return;
    }
    if (form.modifiedAfter && form.modifiedBefore && new Date(form.modifiedAfter).getTime() > new Date(form.modifiedBefore).getTime()) {
      setState((current) => ({ ...current, loading: false }));
      toast.showToast(t("messages.invalidModifiedRange"), 5000);
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      await fetchSearchPage(0, { announceTruncation: true });
    } catch (requestError) {
      setState({ loading: false, error: requestError.message, result: null });
    }
  }

  const total = state.result?.total ?? 0;
  const limit = normalizeSearchPageSize(form.limit);
  const nextPage = page + 1;
  const prevPage = Math.max(page - 1, 0);
  const sortedItems = useMemo(() => {
    const items = (state.result?.items ?? []).map((item) => ({
      ...item,
      displayPath: preferHostPath && item.hostPath ? item.hostPath : item.path,
      displayParentPath: preferHostPath && item.parentHostPath ? item.parentHostPath : item.parentPath
    }));
    items.sort((left, right) => compareSearchRows(left, right, sortBy, sortDir));
    return items;
  }, [preferHostPath, sortBy, sortDir, state.result]);
  const sortedItemsByPath = useMemo(
    () => new Map(sortedItems.map((item) => [item.path, item])),
    [sortedItems]
  );
  const totalPageCount = Math.max(1, Math.ceil(total / limit));
  const selectedResult = useMemo(
    () => (selectedResultPath ? sortedItemsByPath.get(selectedResultPath) : null) || sortedItems[0] || null,
    [selectedResultPath, sortedItems, sortedItemsByPath]
  );
  const selectedResultResolvedPath = selectedResult?.path || "";
  const previewKind = selectedResult?.isDir ? "folder" : getPreviewKind(selectedResult?.name || "");
  const previewRoot = selectedResult?.root || activeRoot;
  const previewURL = selectedResult ? buildPreviewURL(previewRoot, selectedResult.path) : "";
  const mediaPreviewSupported = selectedResult ? isMediaPreviewSupported(selectedResult.name, previewKind) : true;
  const mediaPreviewMessage = selectedResult ? getMediaPreviewMessage(selectedResult.name, previewKind, locale) : "";

  useEffect(() => {
    setPageInput(String(Math.min(page + 1, totalPageCount)));
  }, [page, totalPageCount]);

  useEffect(() => {
    if (!sortedItems.length) {
      setSelectedResultPath("");
      setShowPreviewDetails(false);
      setPreviewDialogOpen(false);
      return;
    }
    if (!selectedResultPath || !sortedItemsByPath.has(selectedResultPath)) {
      setSelectedResultPath(sortedItems[0].path);
      setShowPreviewDetails(false);
      setPreviewDialogOpen(false);
    }
  }, [selectedResultPath, sortedItems, sortedItemsByPath]);

  useEffect(() => {
    if (!selectedResultResolvedPath || !previewRoot || (previewKind !== "text" && previewKind !== "folder")) {
      setTextPreview(null);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    const request = previewKind === "folder"
      ? fetchDirectoryEntries(previewRoot, selectedResultResolvedPath, true).then((payload) => ({
        kind: "archive-list",
        truncated: false,
        entries: (payload?.items || [])
          .filter((item) => item?.name && item.name !== "..")
          .map((item) => ({
            name: item.name,
            path: item.path,
            parentPath: selectedResultResolvedPath,
            depth: 0,
            isDir: Boolean(item.isDir),
            sizeBytes: undefined
          }))
      }))
      : fetchTextPreview(previewRoot, selectedResultResolvedPath);

    request.then((payload) => {
        if (!cancelled) {
          setTextPreview(payload);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setPreviewError(requestError.message);
          setTextPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewKind, previewRoot, selectedResultResolvedPath]);

  const handleFilterWheel = useCallback((event) => {
    if (event.target instanceof Element && event.target.closest(".select-popover")) {
      return;
    }
    if (event.target instanceof HTMLInputElement && event.target.type === "number") {
      return;
    }
    const container = event.currentTarget;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    container.scrollLeft += event.deltaY * 2.4;
  }, []);

  const openPicker = useCallback(() => {
    if (!activeRoot) {
      return;
    }
    setPickerState({
      root: activeRoot,
      browsePath: activePath || activeRoot,
      selectedPath: activePath || activeRoot
    });
  }, [activePath, activeRoot]);

  const handlePickerConfirm = useCallback((selectedPath) => {
    if (!selectedPath) {
      setPickerState(null);
      return;
    }
    const nextRoot = findRootForPath(rootPaths, selectedPath) || pickerState?.root || activeRoot;
    setForm((current) => ({
      ...current,
      root: nextRoot,
      path: selectedPath
    }));
    setSelectedRoots([nextRoot]);
    setPickerState(null);
  }, [activeRoot, pickerState?.root, rootPaths]);

  const toggleSearchRoot = useCallback((rootPath) => {
    setSelectedRoots((current) => {
      const validCurrent = current.filter((item) => rootPaths.includes(item));
      if (validCurrent.includes(rootPath)) {
        if (validCurrent.length === 1) {
          return validCurrent;
        }
        return validCurrent.filter((item) => item !== rootPath);
      }
      return [...validCurrent, rootPath];
    });
  }, [rootPaths]);

  const handleSort = useCallback((nextSortBy) => {
    const nextSortDir = sortBy === nextSortBy
      ? (sortDir === "asc" ? "desc" : "asc")
      : (nextSortBy === "name" ? "asc" : "desc");
    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
  }, [sortBy, sortDir]);

  const handleExportSearch = useCallback(async (mode) => {
    if (!state.result) {
      return;
    }
    setExporting(true);
    toast.showToast(t("messages.exportStarted"));
    try {
      const rows = [];
      if (mode === "page") {
        rows.push(...sortedItems);
      } else {
        const exportBatchSize = 1000;
        let nextOffset = 0;
        let totalRows = state.result.total || 0;
        while (nextOffset < totalRows) {
          const payload = await runSearch({
            ...buildSearchPayload(0),
            limit: exportBatchSize,
            offset: nextOffset
          });
          const items = payload?.items || [];
          rows.push(...items);
          totalRows = Number(payload?.total || totalRows);
          if (!items.length) {
            break;
          }
          nextOffset += items.length;
        }
      }
      const content = toDelimitedText(
        locale === "en"
          ? ["Name", "Path", "Host Path", "Parent Path", "Parent Host Path", "Type", "Extension", "Size Bytes", "Modified At", "Root", "Is Directory"]
          : ["\u540d\u79f0", "\u8def\u5f84", "\u5bbf\u4e3b\u673a\u8def\u5f84", "\u7236\u7ea7\u8def\u5f84", "\u7236\u7ea7\u5bbf\u4e3b\u673a\u8def\u5f84", "\u7c7b\u578b", "\u6269\u5c55\u540d", "\u5927\u5c0f(\u5b57\u8282)", "\u4fee\u6539\u65f6\u95f4", "\u626b\u63cf\u6839\u76ee\u5f55", "\u662f\u5426\u76ee\u5f55"],
        rows.map((item) => [
          item.name,
          preferHostPath && item.hostPath ? item.hostPath : item.path,
          item.hostPath || "",
          preferHostPath && item.parentHostPath ? item.parentHostPath : item.parentPath,
          item.parentHostPath || "",
          item.isDir ? (locale === "en" ? "directory" : "\u76ee\u5f55") : getSearchExportTypeLabel(item.extension, item.isDir, locale),
          item.extension || "",
          item.sizeBytes,
          item.modifiedAt,
          item.root || "",
          item.isDir ? (locale === "en" ? "true" : "\u662f") : (locale === "en" ? "false" : "\u5426")
        ])
      );
      downloadTextFile(buildSearchExportFilename(mode), content, "text/csv;charset=utf-8");
      toast.showToast(t("messages.exportCompleted"));
    } catch (error) {
      toast.showToast(error?.message || t("messages.requestFailed"), 5000);
    } finally {
      setExporting(false);
    }
  }, [buildSearchPayload, locale, preferHostPath, sortedItems, state.result, t, toast.showToast]);

  const jumpToPage = useCallback(async (rawValue) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page + 1));
      return;
    }
    const nextPageNumber = Math.max(1, Math.min(totalPageCount, parsed));
    if (nextPageNumber - 1 === page) {
      setPageInput(String(nextPageNumber));
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      await fetchSearchPage(nextPageNumber - 1);
      setPageInput(String(nextPageNumber));
    } catch (requestError) {
      setState((current) => ({ ...current, loading: false, error: requestError.message }));
      setPageInput(String(page + 1));
    }
  }, [fetchSearchPage, page, totalPageCount]);

  const handlePageSizeChange = useCallback(async (value) => {
    const nextValue = normalizeSearchPageSize(value);
    writeSearchPageSizeSetting(nextValue);
    void persistSettingsToServer().catch(() => {});
    setForm((current) => ({ ...current, limit: nextValue, offset: 0 }));
    if (!state.result) {
      return;
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await runSearch({
        ...buildSearchPayload(0),
        limit: nextValue,
        offset: 0
      });
      setState({ loading: false, error: "", result: payload });
      setPage(0);
      setPageInput("1");
    } catch (requestError) {
      setState((current) => ({ ...current, loading: false, error: requestError.message }));
    }
  }, [buildSearchPayload, state.result]);

  const resetSearchResults = useCallback(() => {
    setState({ loading: false, error: "", result: null });
    setPage(0);
    setPageInput("1");
    setSelectedResultPath("");
    setTextPreview(null);
    setPreviewLoading(false);
    setPreviewError("");
    setShowPreviewDetails(false);
    setPreviewDialogOpen(false);
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        title={t("app.titles.search")}
        actions={
          <>
            <ActionButton tone="secondary" icon="history" onClick={resetSearchResults}>
              {t("actions.reset")}
            </ActionButton>
            <ActionButton icon="manage_search" onClick={handleSearch}>
              {t("actions.executeSearch")}
            </ActionButton>
          </>
        }
      />

      <section className="search-toolbar-strip search-toolbar-search-shell">
        <div className="search-box search-toolbar-search">
          <Icon name="search" className="search-box-icon" />
          <input
            value={form.query}
            placeholder={t("labels.searchInput")}
            onChange={(event) => setForm({ ...form, query: event.target.value })}
          />
        </div>
      </section>

      <section className="search-filter-grid search-toolbar-strip" onWheelCapture={handleFilterWheel}>
        {rootPaths.length > 1 ? (
          <FilterField label={searchRootsLabel} icon="folder_copy" className="search-toolbar-field search-root-scope-field">
            <div className="search-root-picker" ref={rootMenuRef}>
              <button
                type="button"
                className="search-root-trigger"
                onClick={() => setRootMenuOpen((current) => !current)}
                title={searchRootsSummary}
              >
                <span className="select-trigger-label">{searchRootsSummary}</span>
                <Icon name="expand_more" />
              </button>
              {rootMenuOpen && rootMenuStyle
                ? createPortal(
                  <div
                    className="select-popover is-floating search-root-popover"
                    style={rootMenuStyle}
                    ref={rootMenuPopoverRef}
                  >
                    {rootPaths.map((rootPath) => {
                      const active = effectiveSelectedRoots.includes(rootPath);
                      return (
                        <button
                          key={rootPath}
                          type="button"
                          className={`select-option search-root-option ${active ? "is-active" : ""}`}
                          onClick={() => toggleSearchRoot(rootPath)}
                          title={rootPath}
                        >
                          <span className="search-root-option-copy">{pathLabel(rootPath) || rootPath}</span>
                          <Icon
                            name={active ? "check_circle" : "radio_button_unchecked"}
                            className="search-root-option-mark"
                          />
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )
                : null}
            </div>
          </FilterField>
        ) : null}
        <FilterField label={t("labels.path")} icon="folder_copy" className="search-toolbar-field search-picker-field">
          <button type="button" className="file-picker-trigger" onClick={openPicker} disabled={isMultiRootSearch}>
            <span className="file-picker-trigger-copy" title={activePath}>
              {isMultiRootSearch ? multiRootPathHint : (pathLabel(activePath) || activePath)}
            </span>
          </button>
        </FilterField>
        <FilterField label={t("labels.extensions")} icon="filter_alt" className="search-toolbar-field search-extensions-field">
          <input value={form.extensions} placeholder="pdf,mp4,zip" onChange={(event) => setForm({ ...form, extensions: event.target.value })} />
        </FilterField>
        <FilterField label={minSizeLabel} icon="straighten" className="search-toolbar-field search-size-field">
          <div className="size-input-row">
            <input
              type="number"
              step="any"
              placeholder="1024"
              value={form.sizeMin}
              onWheel={(event) => event.stopPropagation()}
              onChange={(event) => setForm({ ...form, sizeMin: event.target.value })}
            />
            <SelectMenu
              value={units.sizeMin}
              options={SEARCH_UNIT_OPTIONS}
              onChange={(value) => setUnits((current) => ({ ...current, sizeMin: value }))}
            />
          </div>
        </FilterField>
        <FilterField label={maxSizeLabel} icon="compress" className="search-toolbar-field search-size-field">
          <div className="size-input-row">
            <input
              type="number"
              step="any"
              placeholder="1024"
              value={form.sizeMax}
              onWheel={(event) => event.stopPropagation()}
              onChange={(event) => setForm({ ...form, sizeMax: event.target.value })}
            />
            <SelectMenu
              value={units.sizeMax}
              options={SEARCH_UNIT_OPTIONS}
              onChange={(value) => setUnits((current) => ({ ...current, sizeMax: value }))}
            />
          </div>
        </FilterField>
        <FilterField label={t("labels.modifiedAfter")} icon="calendar_today" className="search-toolbar-field search-date-field">
          <input type="datetime-local" value={form.modifiedAfter} onChange={(event) => setForm({ ...form, modifiedAfter: event.target.value })} />
        </FilterField>
        <FilterField label={t("labels.modifiedBefore")} icon="event_busy" className="search-toolbar-field search-date-field">
          <input type="datetime-local" value={form.modifiedBefore} onChange={(event) => setForm({ ...form, modifiedBefore: event.target.value })} />
        </FilterField>
      </section>

      {roots.loading && !state.result ? <LoadingState title={t("messages.loadingData")} /> : null}
      {roots.error ? <ErrorState message={roots.error} /> : null}
      {state.loading && !state.result ? <LoadingState title={t("search.loading")} /> : null}
      {state.error ? <ErrorState message={state.error} /> : null}

      {state.result ? (
        <section className="search-results-layout">
          <section className="card">
            <div className="section-heading">
              <h3 className="heading-with-icon"><Icon name="search" className="section-icon" />{t("search.resultsTitle")}</h3>
              <div className="page-header-actions search-results-actions">
                <div className="search-results-summary">
                  {total ? page * limit + 1 : 0}-{Math.min(page * limit + sortedItems.length, total)} / {total}
                </div>
                <div className="search-results-control">
                  <span className="treemap-hint">{t("search.pageSize")}</span>
                  <div className="search-inline-select">
                    <SelectMenu
                      value={limit}
                      options={SEARCH_PAGE_SIZE_MENU_OPTIONS}
                      onChange={(value) => handlePageSizeChange(Number(value))}
                    />
                  </div>
                </div>
                <ActionButton tone="secondary" icon="download" disabled={exporting || !sortedItems.length} onClick={() => handleExportSearch("page")}>
                  {t("search.exportCurrentPage")}
                </ActionButton>
                <ActionButton tone="secondary" icon="table_view" disabled={exporting || !total} onClick={() => handleExportSearch("all")}>
                  {t("search.exportAll")}
                </ActionButton>
              </div>
            </div>
            {state.result?.truncated ? <div className="duplicates-preview-empty compact">{truncationMessage}</div> : null}
            <DataTable
              columns={searchColumns}
              rows={sortedItems}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={(row) => {
                setSelectedResultPath(row.path);
                setShowPreviewDetails(false);
              }}
              emptyText={t("search.empty")}
            />
            <div className="pagination-row">
              <ActionButton tone="secondary" icon="chevron_left" disabled={page <= 0 || state.loading} onClick={() => jumpToPage(prevPage + 1)}>
                {t("actions.previous")}
              </ActionButton>
              <div className="page-jump-group">
                <span className="treemap-hint">{t("hints.page")}</span>
                <input
                  className="page-jump-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value.replace(/\D+/g, ""))}
                  onBlur={(event) => jumpToPage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      jumpToPage(event.currentTarget.value);
                    }
                  }}
                />
                <span className="treemap-hint">/ {totalPageCount}</span>
              </div>
              <ActionButton tone="secondary" icon="chevron_right" disabled={(page + 1) * limit >= total || state.loading} onClick={() => jumpToPage(nextPage + 1)}>
                {t("actions.next")}
              </ActionButton>
            </div>
          </section>

          <aside className="card duplicates-preview-card">
            <div className="duplicates-preview-header">
              <div className="duplicates-preview-copy">
                <h4>{locale === "en" ? "Preview" : "预览"}</h4>
                <span>{selectedResult?.name || (locale === "en" ? "No file selected" : "未选择文件")}</span>
              </div>
              <div className="duplicates-preview-actions">
                {selectedResult ? (
                  <button type="button" className="panel-toggle-button" onClick={() => handleCopyPath(selectedResult.path, selectedResult.hostPath)}>
                    {t("actions.copyPath")}
                  </button>
                ) : null}
              </div>
            </div>
            {selectedResult ? (
              <>
                <div className="duplicates-preview-stage">
                  {previewKind === "image" ? <img className="duplicates-preview-image" src={previewURL} alt={selectedResult.name} /> : null}
                  {previewKind === "video" ? (mediaPreviewSupported
                    ? <video className="duplicates-preview-video" controls preload="metadata" src={previewURL} />
                    : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
                  {previewKind === "audio" ? (mediaPreviewSupported
                    ? <audio className="duplicates-preview-audio" controls preload="metadata" src={previewURL} />
                    : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
                  {previewKind === "pdf" ? <iframe className="duplicates-preview-frame duplicates-preview-frame-pdf" src={previewURL} title={selectedResult.name} /> : null}
                  {(previewKind === "text" || previewKind === "folder")
                    ? (previewLoading
                      ? <div className="duplicates-preview-empty">{locale === "en" ? "Loading preview..." : "正在加载预览..."}</div>
                      : previewError
                        ? <div className="duplicates-preview-empty">{previewError}</div>
                        : textPreview?.kind === "archive-list"
                          ? <ArchivePreviewList entries={textPreview?.entries || []} locale={locale} />
                          : textPreview?.kind === "unsupported"
                            ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div>
                          : <TextPreviewContent content={textPreview?.content || ""} fileName={selectedResult?.name || ""} />)
                    : null}
                  {previewKind === "unsupported" ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div> : null}
                </div>
                <div className="duplicates-preview-meta">
                  <span className="duplicates-preview-size">{formatBytes(selectedResult.sizeBytes)}</span>
                  <button type="button" className="panel-toggle-button" onClick={() => setPreviewDialogOpen(true)}>
                    {locale === "en" ? "Expand Preview" : "放大预览"}
                  </button>
                  <button type="button" className="panel-toggle-button" onClick={() => setShowPreviewDetails((current) => !current)}>
                    {showPreviewDetails ? (locale === "en" ? "Hide Details" : "收起详情") : (locale === "en" ? "Show Details" : "展开详情")}
                  </button>
                  {(previewKind === "text" || previewKind === "folder") && textPreview?.truncated ? <span>{textPreview?.kind === "archive-list" ? (locale === "en" ? "Showing the first 400 items" : "当前仅显示前 400 项") : (locale === "en" ? "Showing the first 64 KB" : "当前仅显示前 64 KB")}</span> : null}
                </div>
                {showPreviewDetails ? (
                  <div className="duplicates-preview-details">
                    <div className="duplicates-preview-detail"><span>{locale === "en" ? "Extension" : "扩展名"}</span><strong>{selectedResult.isDir ? (locale === "en" ? "Folder" : "文件夹") : getExtensionLabel(selectedResult.name)}</strong></div>
                    <div className="duplicates-preview-detail"><span>{locale === "en" ? "Preview Type" : "预览类型"}</span><strong>{previewKindLabel(previewKind, locale)}</strong></div>
                    <div className="duplicates-preview-detail"><span>{locale === "en" ? "Modified" : "修改时间"}</span><strong>{new Date(selectedResult.modifiedAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong></div>
                    <div className="duplicates-preview-detail">
                      <span>{locale === "en" ? "Location" : "所在目录"}</span>
                      <strong className="duplicates-preview-path-value" title={selectedResult.displayParentPath || selectedResult.parentPath}>{selectedResult.displayParentPath || selectedResult.parentPath || "-"}</strong>
                    </div>
                  </div>
                ) : null}
              </>
            ) : <div className="duplicates-preview-empty">{locale === "en" ? "Select a file to preview." : "选择一个文件进行预览。"}</div>}
          </aside>
        </section>
      ) : null}

      <PreviewDialog
        item={selectedResult}
        locale={locale}
        mediaPreviewMessage={mediaPreviewMessage}
        mediaPreviewSupported={mediaPreviewSupported}
        onClose={() => setPreviewDialogOpen(false)}
        open={previewDialogOpen}
        previewKind={previewKind}
        previewRoot={previewRoot}
      />

      {!state.result && !state.loading ? (
        <EmptyState title={t("search.noSearchTitle")} description={t("search.noSearchDesc")} />
      ) : null}

      <FilePickerDialog
        open={Boolean(pickerState)}
        mode="folder"
        roots={roots.items}
        root={pickerRoot}
        browsePath={pickerBrowsePath}
        selectedPath={pickerState?.selectedPath || activePath || ""}
        ignoreList={searchIgnoreList}
        title={locale === "en" ? "Choose search folder" : "选择搜索目录"}
        searchPlaceholder={locale === "en" ? "Search folders..." : "搜索目录..."}
        directories={pickerDirectories}
        onClose={() => setPickerState(null)}
        onConfirm={handlePickerConfirm}
        onRootChange={(root) => setPickerState((current) => ({
          ...current,
          root,
          browsePath: root,
          selectedPath: current?.selectedPath || root
        }))}
        onBrowsePathChange={(browsePath) => setPickerState((current) => ({
          ...current,
          browsePath
        }))}
      />

      <Toast message={toast.message} />
    </div>
  );
}

function normalizeSelectedRoots(selectedRoots, rootPaths, fallbackRoot) {
  const valid = (selectedRoots || []).filter((item) => rootPaths.includes(item));
  if (valid.length) {
    return valid;
  }
  return fallbackRoot ? [fallbackRoot] : [];
}

function samePathList(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function formatSearchRootsSummary(selectedRoots, locale) {
  if (!selectedRoots.length) {
    return locale === "en" ? "No roots selected" : "未选择目录";
  }
  if (selectedRoots.length === 1) {
    return pathLabel(selectedRoots[0]) || selectedRoots[0];
  }
  return locale === "en"
    ? `${selectedRoots.length} roots selected`
    : `已选 ${selectedRoots.length} 个目录`;
}

function buildSearchTruncationMessage(result, locale) {
  if (!result?.truncated) {
    return "";
  }
  const matchedTotal = Number(result.matchedTotal || 0);
  const returnedTotal = Number(result.total || 0);
  const truncatedCount = Number(result.truncatedCount || Math.max(matchedTotal - returnedTotal, 0));
  const resultLimit = Number(result.resultLimit || returnedTotal || 0);
  const truncatedBy = String(result.truncatedBy || "MAX_RESULTS").toUpperCase();
  if (truncatedBy === "REQUEST_LIMIT") {
    if (locale === "en") {
      return `Matched ${matchedTotal} items. Results were truncated to ${returnedTotal} items at the current limit ${resultLimit}, and ${truncatedCount} items were omitted.`;
    }
    return `本次搜索实际命中 ${matchedTotal} 条，已在当前限制 ${resultLimit} 处被截断，因此本次仅返回 ${returnedTotal} 条，另有 ${truncatedCount} 条未返回。`;
  }
  if (locale === "en") {
    return `Matched ${matchedTotal} items. The current query reached the server safety limit ${truncatedBy}=${resultLimit}, so only ${returnedTotal} items were returned and ${truncatedCount} items were omitted. If you need more, increase ${truncatedBy} in the server or Docker deployment configuration.`;
  }
  return `本次搜索实际命中 ${matchedTotal} 条，但已达到服务端安全上限 ${truncatedBy}=${resultLimit}，因此结果被截断。本次仅返回 ${returnedTotal} 条，另有 ${truncatedCount} 条未返回。如需继续提高，请修改服务端或 Docker 部署配置中的 ${truncatedBy}。`;
}

function normalizeSearchPageSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return readSearchPageSizeSetting();
  }
  return Math.min(Math.max(parsed, 10), 500);
}

function buildSearchExportFilename(mode) {
  const date = new Date().toISOString().replace(/[:.]/g, "-");
  return mode === "page" ? `search-page-${date}.csv` : `search-results-${date}.csv`;
}

function getSearchExportTypeLabel(extension, isDir, locale) {
  if (isDir) {
    return locale === "en" ? "directory" : "\u76ee\u5f55";
  }
  return extension ? extension.toLowerCase() : (locale === "en" ? "file" : "\u6587\u4ef6");
}

function compareSearchRows(left, right, sortBy, sortDir) {
  const result = compareSearchRowValue(left, right, sortBy);
  if (result !== 0) {
    return sortDir === "asc" ? result : -result;
  }

  const nameTieBreak = compareSearchRowValue(left, right, "name");
  if (nameTieBreak !== 0) {
    return nameTieBreak;
  }
  return naturalCompare(left.path || "", right.path || "");
}

function compareSearchRowValue(left, right, sortBy) {
  switch ((sortBy || "size").toLowerCase()) {
    case "name":
      return naturalCompare(left.name || "", right.name || "");
    case "type":
      return naturalCompare(left.extension || "", right.extension || "");
    case "date":
      return compareNumbers(parseSearchTime(left.modifiedAt), parseSearchTime(right.modifiedAt));
    case "size":
    default:
      return compareNumbers(Number(left.sizeBytes || 0), Number(right.sizeBytes || 0));
  }
}

function parseSearchTime(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareNumbers(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function naturalCompare(left, right) {
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}
