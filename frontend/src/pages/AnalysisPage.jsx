import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { TreemapChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { buildPreviewURL, createAnalyzeJob, fetchAnalyzeJob, fetchAnalyzeTree, fetchTextPreview, releaseRuntimeMemory } from "../api/client";
import ActionButton from "../components/ActionButton";
import ArchivePreviewList from "../components/ArchivePreviewList";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilePickerDialog from "../components/FilePickerDialog";
import FilterField from "../components/FilterField";
import HistoryPanel from "../components/HistoryPanel";
import Icon from "../components/Icon";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import PreviewDialog from "../components/PreviewDialog";
import TextPreviewContent from "../components/TextPreviewContent";
import Toast from "../components/Toast";
import useDirectories from "../hooks/useDirectories";
import useRoots from "../hooks/useRoots";
import useToast from "../hooks/useToast";
import { clearAnalysisHistory, deleteAnalysisHistory, listAnalysisHistory, readAnalysisHistory, saveAnalysisHistory } from "../lib/analysisHistory";
import { copyResolvedPath as copyPreferredPath } from "../lib/copyPath";
import { formatBytes, formatHistoryTime } from "../lib/format";
import { getFileMeta, normalizeTypeStats } from "../lib/fileMeta";
import { useI18n } from "../lib/i18n.jsx";
import { createMemoryStateStore } from "../lib/memoryState";
import { getMediaPreviewMessage, isMediaPreviewSupported } from "../lib/mediaPreview";
import { findRootForPath, parentPath, pathLabel } from "../lib/pathUtils";
import { getExtensionLabel, getPreviewKind, previewKindLabel } from "../lib/previewFile";
import { registerMemoryResetter } from "../lib/runtimeMemory";
import { isIgnoredPath, readCopyHostPathSetting, readScanIgnoreList, readTreemapDetailLevelSetting, readTreemapFileColorModeSetting } from "../lib/settingsStore";

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

const MAX_VISIBLE = 30;
const ANALYSIS_HISTORY_LIMIT = 10;
const ANALYSIS_CHUNK_DEPTH = 3;
const DEFAULT_ANALYSIS_STATE = {
  form: { root: "", path: "", topN: "", maxDepth: "" },
  jobId: "",
  job: null,
  focusPath: "",
  visibleOffset: 0,
  viewMode: "all",
  topPage: 0,
  selectedTopFilePath: ""
};
const analysisStateStore = createMemoryStateStore(DEFAULT_ANALYSIS_STATE);
registerMemoryResetter("analysis-page", () => {
  analysisStateStore.reset();
});

export default function AnalysisPage() {
  const { t, locale } = useI18n();
  const roots = useRoots();
  const initialAnalysisState = useMemo(() => analysisStateStore.read(), []);
  const [form, setForm] = useState(() => initialAnalysisState.form);
  const [jobId, setJobId] = useState(() => initialAnalysisState.jobId);
  const [job, setJob] = useState(() => initialAnalysisState.job);
  const [error, setError] = useState("");
  const [focusPath, setFocusPath] = useState(() => initialAnalysisState.focusPath);
  const [visibleOffset, setVisibleOffset] = useState(() => initialAnalysisState.visibleOffset);
  const [viewMode, setViewMode] = useState(() => initialAnalysisState.viewMode);
  const [topPage, setTopPage] = useState(() => initialAnalysisState.topPage);
  const [topPageInput, setTopPageInput] = useState(() => String(initialAnalysisState.topPage + 1));
  const [selectedTopFilePath, setSelectedTopFilePath] = useState(() => initialAnalysisState.selectedTopFilePath || "");
  const [topFilePreview, setTopFilePreview] = useState(null);
  const [topFilePreviewLoading, setTopFilePreviewLoading] = useState(false);
  const [topFilePreviewError, setTopFilePreviewError] = useState("");
  const [showTopFilePreviewDetails, setShowTopFilePreviewDetails] = useState(false);
  const [topFilePreviewDialogOpen, setTopFilePreviewDialogOpen] = useState(false);
  const [treemapFileColorMode, setTreemapFileColorMode] = useState(() => readTreemapFileColorModeSetting());
  const [treemapDetailLevel, setTreemapDetailLevel] = useState(() => readTreemapDetailLevelSetting());
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoringHistoryId, setRestoringHistoryId] = useState("");
  const [loadingTreePath, setLoadingTreePath] = useState("");
  const [pickerState, setPickerState] = useState(null);
  const toast = useToast();
  const historyRef = useRef(null);
  const lastStoredHistoryKeyRef = useRef("");
  const chartRef = useRef(null);
  const highlightedDataIndexRef = useRef(null);
  const analyzeRequestVersionRef = useRef(0);
  const analyzePollFailureCountRef = useRef(0);
  const rootPaths = useMemo(() => roots.items.map((item) => item?.path).filter(Boolean), [roots.items]);
  const activeRoot = rootPaths.includes(form.root) ? form.root : rootPaths[0] || "";
  const activePath = form.path && findRootForPath(rootPaths, form.path) === activeRoot ? form.path : activeRoot;
  const pickerRoot = pickerState?.root || activeRoot;
  const pickerBrowsePath = pickerState?.browsePath || activePath || activeRoot;
  const pickerDirectories = useDirectories(pickerRoot, pickerBrowsePath);
  const fileColumns = useMemo(() => ([
    { key: "name", label: t("labels.fileNamePath") },
    { key: "sizeBytes", label: t("labels.size") },
    { key: "extension", label: t("labels.type") },
    { key: "modifiedAt", label: t("labels.modified") }
  ]), [t]);
  const folderColumns = useMemo(() => ([
    { key: "name", label: t("labels.folderNamePath") },
    { key: "sizeBytes", label: t("labels.size") },
    { key: "fileCount", label: t("labels.items") }
  ]), [t]);
  const scanIgnoreList = useMemo(() => readScanIgnoreList(), [roots.items.length]);
  const preferHostPath = readCopyHostPathSetting();

  useEffect(() => {
    setTreemapFileColorMode(readTreemapFileColorModeSetting());
    setTreemapDetailLevel(readTreemapDetailLevelSetting());
  }, []);

  useEffect(() => {
    if (!rootPaths.length) {
      return;
    }
    if (!rootPaths.includes(form.root) || !form.path || findRootForPath(rootPaths, form.path) !== form.root) {
      const nextRoot = rootPaths[0];
      setForm((current) => ({
        ...current,
        root: nextRoot,
        path: nextRoot
      }));
    }
  }, [form.path, form.root, rootPaths]);

  useEffect(() => {
    if (isIgnoredPath(activePath, scanIgnoreList) && activeRoot) {
      setForm((current) => ({ ...current, path: activeRoot }));
      setFocusPath((current) => (isIgnoredPath(current, scanIgnoreList) ? activeRoot : current));
    }
  }, [activePath, activeRoot, scanIgnoreList]);

  useEffect(() => {
    if (!jobId || (job?.status && job.status !== "running" && job.status !== "pending")) {
      return undefined;
    }

    const requestVersion = analyzeRequestVersionRef.current;
    const timer = window.setInterval(() => {
      fetchAnalyzeJob(jobId)
        .then((payload) => {
          if (analyzeRequestVersionRef.current !== requestVersion) {
            return;
          }
          analyzePollFailureCountRef.current = 0;
          if (!payload || typeof payload !== "object" || typeof payload.status !== "string") {
            setError("Invalid analyze job payload");
            window.clearInterval(timer);
            return;
          }
          setJob(payload);
          if (payload.status !== "error") {
            setError("");
          }
          if (payload.status === "error") {
            setError(payload.error || t("messages.requestFailed"));
          }
          if (payload.status === "done" || payload.status === "error") {
            window.clearInterval(timer);
          }
        })
        .catch((requestError) => {
          if (analyzeRequestVersionRef.current !== requestVersion) {
            return;
          }
          analyzePollFailureCountRef.current += 1;
          if (analyzePollFailureCountRef.current >= 3) {
            setError(requestError.message);
            window.clearInterval(timer);
          }
        });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [job?.status, jobId]);

  useEffect(() => {
    if (job?.status === "done" && job?.result?.tree?.path) {
      setFocusPath((current) => current || job.result.tree.path);
    }
  }, [job]);

  useEffect(() => {
    let cancelled = false;

    setHistoryLoading(true);
    listAnalysisHistory(ANALYSIS_HISTORY_LIMIT)
      .then((entries) => {
        if (!cancelled) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!historyOpen) {
      return undefined;
    }

    let cancelled = false;
    setHistoryLoading(true);
    listAnalysisHistory(ANALYSIS_HISTORY_LIMIT)
      .then((entries) => {
        if (!cancelled) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [historyOpen]);

  useEffect(() => {
    if (job?.status !== "done" || !job?.result) {
      return;
    }

    const entry = buildHistoryEntry(job, form);
    if (!entry) {
      return;
    }

    if (lastStoredHistoryKeyRef.current === entry.id) {
      return;
    }
    lastStoredHistoryKeyRef.current = entry.id;

    saveAnalysisHistory(entry, ANALYSIS_HISTORY_LIMIT)
      .then((entries) => {
        setHistoryEntries(entries);
        setHistoryLoading(false);
      })
      .catch(() => {
        toast.showToast(t("messages.historySaveFailed"));
      });
  }, [form, job, toast, t]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (historyRef.current?.contains(event.target)) {
        return;
      }
      setHistoryOpen(false);
    }

    if (!historyOpen) {
      return undefined;
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [historyOpen]);

  async function handleHistoryClear() {
    try {
      setHistoryLoading(true);
      const entries = await clearAnalysisHistory();
      setHistoryEntries(entries);
      toast.showToast(t("messages.historyCleared"));
    } catch (historyError) {
      toast.showToast(historyError.message || t("messages.requestFailed"));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleHistoryDelete(entryId) {
    try {
      setHistoryLoading(true);
      const entries = await deleteAnalysisHistory(entryId, ANALYSIS_HISTORY_LIMIT);
      setHistoryEntries(entries);
      toast.showToast(t("messages.historyRemoved"));
    } catch (historyError) {
      toast.showToast(historyError.message || t("messages.requestFailed"));
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    analysisStateStore.write({
      form,
      jobId,
      job,
      focusPath,
      visibleOffset,
      viewMode,
      topPage,
      selectedTopFilePath
    });
  }, [focusPath, form, job, jobId, selectedTopFilePath, topPage, viewMode, visibleOffset]);

  function resetAnalysisRuntimeState() {
    analyzeRequestVersionRef.current += 1;
    analyzePollFailureCountRef.current = 0;
    setJobId("");
    setJob(null);
    setError("");
    setLoadingTreePath("");
    setFocusPath("");
    setVisibleOffset(0);
    setViewMode("all");
    setTopPage(0);
    setTopPageInput("1");
    setSelectedTopFilePath("");
    setTopFilePreview(null);
    setTopFilePreviewLoading(false);
    setTopFilePreviewError("");
    setShowTopFilePreviewDetails(false);
    setTopFilePreviewDialogOpen(false);
    lastStoredHistoryKeyRef.current = "";
    clearAnalysisState();
  }

  const rootNode = job?.result?.tree ?? null;
  const hasAnalysisTree = Boolean(rootNode?.path);
  const isAnalyzeRunning = job?.status === "running" || job?.status === "pending";
  const isAnalyzeCanceled = job?.status === "canceled";
  const isAnalyzeErrored = job?.status === "error";
  const analyzeErrorMessage = job?.error || error || t("messages.requestFailed");
  const shouldShowAnalyzeLoading =
    !restoringHistoryId
    && !hasAnalysisTree
    && Boolean(job)
    && !isAnalyzeErrored
    && !isAnalyzeCanceled;
  const treeIndexes = useMemo(() => buildTreeIndexes(rootNode), [rootNode]);
  const activeNode = useMemo(() => (focusPath ? treeIndexes.nodeIndex.get(focusPath) : null) ?? rootNode, [focusPath, rootNode, treeIndexes]);
  const sortedChildren = useMemo(
    () => sortNodesForView(activeNode?.children ?? [], viewMode),
    [activeNode, viewMode]
  );
  const visibleNodes = useMemo(
    () => sortedChildren.slice(visibleOffset, visibleOffset + MAX_VISIBLE),
    [sortedChildren, visibleOffset]
  );
  const maxOffset = Math.max(0, sortedChildren.length - MAX_VISIBLE);
  const breadcrumbItems = useMemo(
    () => buildBreadcrumbs(rootNode, activeNode?.path, treeIndexes.parentIndex),
    [activeNode, rootNode, treeIndexes]
  );

  const folderRows = useMemo(
    () => {
      const rows = (activeNode?.children ?? [])
        .filter((item) => item.type === "directory")
        .map((item) => ({
          id: item.path,
          name: item.name,
          path: item.path,
          hostPath: item.hostPath,
          displayPath: preferHostPath && item.hostPath ? item.hostPath : item.path,
          displayParentPath: preferHostPath && item.hostPath ? item.hostPath : item.path,
          parentPath: item.path,
          sizeBytes: item.sizeBytes,
          fileCount: item.fileCount,
          isDir: true,
          extension: "folder"
        }))
        .sort((a, b) => b.sizeBytes - a.sizeBytes);

      if (activeNode?.path && rootNode?.path && activeNode.path !== rootNode.path) {
        rows.unshift({
          id: `${activeNode.path}::__parent__`,
          name: "..",
          path: parentPath(activeNode.path, rootNode.path),
          hostPath: parentPath(activeNode.hostPath || "", rootNode.hostPath || ""),
          displayPath: preferHostPath && activeNode.hostPath ? parentPath(activeNode.hostPath, rootNode.hostPath || "") : parentPath(activeNode.path, rootNode.path),
          displayParentPath: preferHostPath && activeNode.hostPath ? parentPath(activeNode.hostPath, rootNode.hostPath || "") : parentPath(activeNode.path, rootNode.path),
          parentPath: activeNode.path,
          sizeBytes: 0,
          fileCount: 0,
          type: "folder",
          isDir: true,
          extension: "folder"
        });
      }

      return rows;
    },
    [activeNode, preferHostPath, rootNode]
  );
  const topFileLimit = (() => {
    const limit = Number(form.topN || 0);
    return limit > 0 ? Math.max(limit, 1) : 0;
  })();
  const fileAnalysis = useMemo(() => analyzeNodeFiles(activeNode, topFileLimit), [activeNode, topFileLimit]);
  const typeStats = useMemo(() => normalizeTypeStats(fileAnalysis.typeStats), [fileAnalysis.typeStats]);
  const scopedTopFiles = fileAnalysis.topFiles;
  async function handleCopyResolvedPath(path, hostPath) {
    await copyPreferredPath(path, hostPath, toast.showToast, t);
  }
  const topFilesPageRows = useMemo(
    () => scopedTopFiles
      .slice(topPage * 10, topPage * 10 + 10)
      .map((item) => ({
        ...item,
        displayPath: preferHostPath && item.hostPath ? item.hostPath : item.path,
        displayParentPath: preferHostPath && item.parentHostPath ? item.parentHostPath : item.parentPath
      })),
    [preferHostPath, scopedTopFiles, topPage]
  );
  const topFileTableColumns = useMemo(() => ([
    ...fileColumns,
    {
      key: "action",
      label: t("labels.action"),
      render: (_value, row) => (
        <button
          type="button"
          className="inline-copy-button"
          onClick={(event) => {
            event.stopPropagation();
            handleCopyResolvedPath(row.path, row.hostPath);
          }}
        >
          {t("actions.copyPath")}
        </button>
      )
    }
  ]), [fileColumns, handleCopyResolvedPath, t]);
  const topFilesPageCount = Math.max(1, Math.ceil(scopedTopFiles.length / 10));
  const topFilesByPath = useMemo(
    () => new Map(scopedTopFiles.map((item) => [item.path, item])),
    [scopedTopFiles]
  );
  const selectedTopFile = useMemo(
    () => (selectedTopFilePath ? topFilesByPath.get(selectedTopFilePath) : null) || topFilesPageRows[0] || null,
    [selectedTopFilePath, topFilesByPath, topFilesPageRows]
  );
  const topFilePreviewKind = getPreviewKind(selectedTopFile?.name || "");
  const topFilePreviewRoot = selectedTopFile ? (findRootForPath(rootPaths, selectedTopFile.path) || activeRoot) : activeRoot;
  const topFilePreviewURL = selectedTopFile ? buildPreviewURL(topFilePreviewRoot, selectedTopFile.path) : "";
  const topFileMediaPreviewSupported = selectedTopFile ? isMediaPreviewSupported(selectedTopFile.name, topFilePreviewKind) : true;
  const topFileMediaPreviewMessage = selectedTopFile ? getMediaPreviewMessage(selectedTopFile.name, topFilePreviewKind, locale) : "";

  useEffect(() => {
    setTopPageInput(String(Math.min(topPage + 1, topFilesPageCount)));
  }, [topFilesPageCount, topPage]);

  useEffect(() => {
    if (!scopedTopFiles.length) {
      setSelectedTopFilePath("");
      setShowTopFilePreviewDetails(false);
      setTopFilePreviewDialogOpen(false);
      return;
    }
    if (!selectedTopFilePath || !topFilesByPath.has(selectedTopFilePath)) {
      setSelectedTopFilePath(scopedTopFiles[0].path);
      setShowTopFilePreviewDetails(false);
      setTopFilePreviewDialogOpen(false);
    }
  }, [scopedTopFiles, selectedTopFilePath, topFilesByPath]);

  useEffect(() => {
    if (!selectedTopFile || topFilePreviewKind !== "text") {
      setTopFilePreview(null);
      setTopFilePreviewLoading(false);
      setTopFilePreviewError("");
      return;
    }
    let cancelled = false;
    setTopFilePreviewLoading(true);
    setTopFilePreviewError("");
    fetchTextPreview(topFilePreviewRoot, selectedTopFile.path)
      .then((payload) => {
        if (!cancelled) {
          setTopFilePreview(payload);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setTopFilePreviewError(requestError.message);
          setTopFilePreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTopFilePreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopFile, topFilePreviewKind, topFilePreviewRoot]);

  const treemapData = useMemo(() => {
    const scopeSize = Math.max(activeNode?.sizeBytes || 0, 1);
    const scopeNodes = visibleNodes;
    const rootMaxSize = largestNodeSize(scopeNodes);
    return activeNode
      ? scopeNodes.map((node, index) =>
          mapTreemapNode(node, scopeSize, rootMaxSize, index, 0, viewMode, focusPath, activeNode.path, treemapFileColorMode, treemapDetailLevel)
        )
      : [];
  }, [activeNode, focusPath, treemapDetailLevel, treemapFileColorMode, viewMode, visibleNodes]);
  const renderedNodeCount = useMemo(() => countTreemapNodes(treemapData), [treemapData]);
  const treemapOption = useMemo(() => {
    return {
      backgroundColor: "transparent",
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      animationThreshold: 2000,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicOut",
      tooltip: {
        show: renderedNodeCount < 520,
        triggerOn: "mousemove|click",
        transitionDuration: 0,
        showDelay: 0,
        hideDelay: 0,
        confine: true,
        formatter: ({ data }) => `${data.name}<br/>${formatBytes(data.rawSize)}<br/>${data.percentText}`
      },
      series: [
        {
          type: "treemap",
          animation: false,
          animationDuration: 0,
          animationDurationUpdate: 0,
          nodeClick: false,
          roam: false,
          breadcrumb: { show: false },
          sort: "desc",
          squareRatio: 1,
          leafDepth: undefined,
          visibleMin: 1,
          colorMappingBy: "id",
          universalTransition: false,
          hoverLayerThreshold: 800,
          width: "100%",
          height: "100%",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zoomToNodeRatio: 0.92,
          label: {
            show: true,
            formatter: treemapLabelFormatter,
            align: "center",
            verticalAlign: "middle",
            padding: 6,
            lineHeight: 17,
            overflow: "truncate",
            width: 92
          },
          upperLabel: { show: false },
          levels: [
            {
              upperLabel: { show: false },
              itemStyle: {
                gapWidth: 3,
                borderWidth: 2.2,
                borderColor: "#8bb6e4"
              }
            },
            {
              upperLabel: {
                show: true,
                height: 22,
                color: "#1f4f82",
                fontWeight: 700,
                overflow: "truncate",
                formatter: treemapUpperLabelFormatter
              },
              itemStyle: {
                gapWidth: 2,
                borderWidth: 1.8,
                borderColor: "#98bee6"
              }
            },
            {
              upperLabel: {
                show: true,
                height: 18,
                color: "#1f4f82",
                fontWeight: 700,
                overflow: "truncate",
                formatter: treemapUpperLabelFormatter
              },
              itemStyle: {
                gapWidth: 1,
                borderWidth: 1.05,
                borderColor: "#adcceb"
              }
            },
            {
              upperLabel: {
                show: true,
                height: 16,
                color: "#1f4f82",
                fontWeight: 700,
                overflow: "truncate",
                formatter: treemapUpperLabelFormatter
              },
              itemStyle: {
                gapWidth: 0,
                borderWidth: 0.45,
                borderColor: "#c7dbef"
              }
            }
          ],
          itemStyle: {
            borderWidth: 2.2,
            gapWidth: 3,
            borderColor: "#b6d0ea"
          },
          data: treemapData
        }
      ]
    };
  }, [renderedNodeCount, treemapData]);

  async function loadAnalysisNode(path) {
    if (!path || loadingTreePath === path || !job?.result?.tree) {
      return true;
    }
    const targetNode = treeIndexes.nodeIndex.get(path);
    if (!targetNode?.isDir && targetNode?.type !== "directory") {
      return true;
    }
    if (!targetNode?.hasLazyChildren || (targetNode.children ?? []).length > 0) {
      return true;
    }

    const remainingDepth = resolveRemainingAnalyzeDepth(Number(form.maxDepth || 0), treeIndexes.depthIndex.get(path) ?? 0);
    if (remainingDepth <= 0) {
      return true;
    }

    setLoadingTreePath(path);
    const payload = await fetchAnalyzeTree({
      root: activeRoot,
      path,
      maxDepth: remainingDepth,
      topN: Number(form.topN || 0),
      ignore: scanIgnoreList
    }).catch((requestError) => {
      setError(requestError.message);
      toast.showToast(requestError.message || t("messages.requestFailed"));
      return null;
    });
    setLoadingTreePath("");
    if (!payload?.tree?.path) {
      return false;
    }

    setJob((current) => {
      if (!current?.result?.tree) {
        return current;
      }
      return {
        ...current,
        result: {
          ...current.result,
          updatedAt: payload.updatedAt || current.result.updatedAt,
          tree: mergeAnalysisTree(current.result.tree, path, payload.tree)
        }
      };
    });
    return true;
  }

  const chartEvents = useMemo(
    () => ({
      click: async (params) => {
        if (params?.data?.drillPath) {
          const nextPath = params.data.drillPath;
          const loaded = await loadAnalysisNode(nextPath);
          if (!loaded) {
            return;
          }
          startTransition(() => {
            setForm((current) => ({ ...current, path: nextPath }));
            setFocusPath(nextPath);
            setVisibleOffset(0);
            setTopPage(0);
          });
        }
      }
    }),
    [loadAnalysisNode]
  );

  function clearExternalTreemapHighlight() {
    const instance = chartRef.current?.getEchartsInstance?.();
    const previousDataIndex = highlightedDataIndexRef.current;
    if (!instance || previousDataIndex == null) {
      highlightedDataIndexRef.current = null;
      return;
    }
    instance.dispatchAction({ type: "downplay", seriesIndex: 0, dataIndex: previousDataIndex });
    highlightedDataIndexRef.current = null;
  }

  function highlightTreemapPath(path) {
    const instance = chartRef.current?.getEchartsInstance?.();
    if (!instance || !path) {
      clearExternalTreemapHighlight();
      return;
    }
    const seriesModel = instance.getModel()?.getSeriesByIndex?.(0);
    const treeRoot = seriesModel?.getData?.()?.tree?.root;
    const targetNode = treeRoot?.getNodeById?.(path);
    const dataIndex = targetNode?.dataIndex;
    if (dataIndex == null) {
      clearExternalTreemapHighlight();
      return;
    }
    if (highlightedDataIndexRef.current === dataIndex) {
      return;
    }
    clearExternalTreemapHighlight();
    instance.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex });
    highlightedDataIndexRef.current = dataIndex;
  }

  async function handleAnalyze() {
    const previousJobId = jobId;
    const requestVersion = analyzeRequestVersionRef.current + 1;
    analyzeRequestVersionRef.current = requestVersion;
    analyzePollFailureCountRef.current = 0;
    setError("");
    setJobId("");
    setJob({
      jobId: "",
      status: "pending",
      result: null,
      createdAt: new Date().toISOString()
    });
    lastStoredHistoryKeyRef.current = "";
    if (isIgnoredPath(form.path, scanIgnoreList)) {
      toast.showToast(t("messages.excludedPath"));
      return;
    }
    if (previousJobId) {
      await releaseRuntimeMemory({ analyzeJobId: previousJobId }).catch(() => {});
    }
    const payload = await createAnalyzeJob({
      root: activeRoot,
      path: activePath,
      maxDepth: resolveInitialAnalyzeDepth(Number(form.maxDepth || 0)),
      topN: Number(form.topN),
      ignore: scanIgnoreList
    }).catch((requestError) => {
      if (analyzeRequestVersionRef.current !== requestVersion) {
        return null;
      }
      setError(requestError.message);
      return null;
    });
    if (!payload) {
      if (analyzeRequestVersionRef.current === requestVersion) {
        setJob(null);
      }
      return;
    }
    if (analyzeRequestVersionRef.current !== requestVersion) {
      return;
    }
    setFocusPath(activePath);
    setVisibleOffset(0);
    setTopPage(0);
    setJobId(payload.jobId);
    setJob(payload);
  }

  function openPicker() {
    if (!activeRoot) {
      return;
    }
    setPickerState({
      root: activeRoot,
      browsePath: activePath || activeRoot,
      selectedPath: activePath || activeRoot
    });
  }

  function handlePickerConfirm(selectedPath) {
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
    setPickerState(null);
  }

  function drillTo(path) {
    if (!path) {
      return;
    }
    void loadAnalysisNode(path).then((loaded) => {
      if (!loaded) {
        return;
      }
      startTransition(() => {
        setForm((current) => ({ ...current, path }));
        setFocusPath(path);
        setVisibleOffset(0);
        setTopPage(0);
      });
    });
  }

  function animateToPath(path) {
    if (!path) {
      return;
    }
    drillTo(path);
  }

  function jumpToTopPage(rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setTopPageInput(String(topPage + 1));
      return;
    }
    const nextPage = Math.max(1, Math.min(topFilesPageCount, parsed));
    setTopPage(nextPage - 1);
    setTopPageInput(String(nextPage));
  }

  function handleWheel(event) {
    if (!sortedChildren.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setVisibleOffset((current) => {
      const next = event.deltaY > 0 ? current + 1 : current - 1;
      return Math.max(0, Math.min(maxOffset, next));
    });
  }

  function handleBreadcrumbWheel(event) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY;
  }

  async function restoreHistoryEntry(entrySummary) {
    if (!entrySummary?.id) {
      return;
    }
    setRestoringHistoryId(entrySummary.id);
    resetAnalysisRuntimeState();
    const entry = await readAnalysisHistory(entrySummary.id).catch((historyError) => {
      toast.showToast(historyError.message || t("messages.requestFailed"));
      return null;
    });
    if (!entry?.result?.tree) {
      setRestoringHistoryId("");
      return;
    }
    lastStoredHistoryKeyRef.current = entry.id;

    startTransition(() => {
      setForm({
        root: entry.root || form.root,
        path: entry.path || entry.result.path || entry.result.tree.path,
        topN: String(entry.topN ?? 10),
        maxDepth: entry.maxDepth ? String(entry.maxDepth) : ""
      });
      setJobId("");
      setJob({
        jobId: entry.id,
        status: "done",
        result: entry.result,
        createdAt: entry.createdAt || entry.savedAt
      });
      setError("");
      setFocusPath(entry.focusPath || entry.path || entry.result.tree.path);
      setVisibleOffset(0);
      setTopPage(0);
      setViewMode("all");
      setRestoringHistoryId("");
    });
    setHistoryOpen(false);
    toast.showToast(t("messages.historyRestored"));
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={t("app.titles.analysis")}
        actions={
          <>
            <div className="history-menu" ref={historyRef}>
              <ActionButton tone="secondary" icon="history" onClick={() => setHistoryOpen((current) => !current)}>
                {t("actions.history")}
              </ActionButton>
              {historyOpen ? (
                <HistoryPanel
                  title={t("messages.historyTitle")}
                  count={historyEntries.length}
                  limit={ANALYSIS_HISTORY_LIMIT}
                  clearLabel={t("actions.clearHistory")}
                  emptyLabel={t("messages.noHistory")}
                  isLoading={historyLoading}
                  loadingLabel={locale === "en" ? "Loading history..." : "正在加载历史..."}
                  entries={historyEntries}
                  onClear={handleHistoryClear}
                  renderEntry={(entry) => (
                    <div key={entry.id} className="history-item">
                      <button type="button" className="history-item-main" onClick={() => restoreHistoryEntry(entry)}>
                        <span className="history-item-title" title={entry.path}>{pathLabel(entry.path || entry.result?.path || entry.root)}</span>
                        <span className="history-item-meta">
                          {restoringHistoryId === entry.id
                            ? (locale === "en" ? "Loading history..." : "正在加载历史...")
                            : t("analysis.historyMeta", { size: formatBytes(entry.sizeBytes || 0), depth: entry.maxDepth || t("analysis.depthAll"), time: formatHistoryTime(entry.savedAt) })}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="history-delete-button"
                        onClick={() => handleHistoryDelete(entry.id)}
                      >
                        {t("actions.delete")}
                      </button>
                    </div>
                  )}
                />
              ) : null}
            </div>
            <ActionButton
              tone="secondary"
              icon="restart_alt"
              onClick={async () => {
                const activeJobId = jobId;
                resetAnalysisRuntimeState();
                if (activeJobId) {
                  await releaseRuntimeMemory({ analyzeJobId: activeJobId }).catch(() => {});
                }
              }}
            >
              {t("actions.clear")}
            </ActionButton>
            <ActionButton icon="play_arrow" onClick={handleAnalyze}>
              {t("actions.startScan")}
            </ActionButton>
          </>
        }
      />

      <section className="analysis-toolbar-strip">
        <div className="analysis-control-grid">
          <FilterField label={locale === "en" ? "Scan Folder" : "扫描目录"} icon="folder_copy" className="analysis-toolbar-field analysis-picker-field">
            <button type="button" className="file-picker-trigger" onClick={openPicker}>
              <span className="file-picker-trigger-copy" title={activePath}>
                {pathLabel(activePath) || activePath}
              </span>
            </button>
          </FilterField>
          <FilterField label={t("labels.scanDepth")} icon="layers" className="analysis-toolbar-field">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("analysis.scanDepthPlaceholder")}
              value={form.maxDepth ?? ""}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D+/g, "");
                setForm((current) => ({ ...current, maxDepth: nextValue }));
              }}
            />
          </FilterField>
          <FilterField label={t("labels.topFiles")} icon="leaderboard" className="analysis-toolbar-field">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("analysis.topFilesPlaceholder")}
              value={form.topN ?? ""}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D+/g, "");
                setForm({ ...form, topN: nextValue });
              }}
            />
          </FilterField>
        </div>
      </section>

      {roots.loading && !hasAnalysisTree && !restoringHistoryId ? <LoadingState title={t("messages.loadingData")} /> : null}
      {roots.error ? <ErrorState message={roots.error} /> : null}
      {isAnalyzeErrored && !hasAnalysisTree && !restoringHistoryId ? <ErrorState message={analyzeErrorMessage} /> : null}
      {error && !isAnalyzeErrored ? <ErrorState message={error} /> : null}
      {restoringHistoryId ? <LoadingState title={locale === "en" ? "Loading history..." : "正在加载历史..."} /> : null}
      {shouldShowAnalyzeLoading ? <LoadingState title={isAnalyzeRunning ? t("analysis.loading") : (locale === "en" ? "Preparing analysis..." : "正在准备分析...")} /> : null}
      {isAnalyzeCanceled && !hasAnalysisTree && !restoringHistoryId ? <ErrorState message={locale === "en" ? "Analysis was canceled." : "分析已取消。"} /> : null}
      {job?.status === "done" && !hasAnalysisTree && !restoringHistoryId ? <ErrorState message={locale === "en" ? "Analysis finished but no result was returned." : "分析已完成，但没有返回结果。"} /> : null}
      {loadingTreePath && activeNode?.path === loadingTreePath ? <LoadingState title={locale === "en" ? "Loading folder..." : "正在加载目录..."} /> : null}

      {job?.status === "done" && hasAnalysisTree ? (
        <>
          <section className="analysis-layout">
            <div className="card panel-tall">
              <div className="section-heading">
                <h3 className="heading-with-icon"><Icon name="grid_view" className="section-icon" />{t("analysis.treemapTitle")}</h3>
                <div className="treemap-heading-actions">
                  <div className="segment-switch">
                    <button type="button" className={viewMode === "all" ? "is-active" : ""} onClick={() => setViewMode("all")}>{t("labels.viewAll")}</button>
                    <button type="button" className={viewMode === "folders" ? "is-active" : ""} onClick={() => setViewMode("folders")}>{t("labels.viewFolders")}</button>
                    <button type="button" className={viewMode === "files" ? "is-active" : ""} onClick={() => setViewMode("files")}>{t("labels.viewFiles")}</button>
                  </div>
                  <span className="treemap-hint">
                    {t("hints.visible")} {visibleNodes.length} / {sortedChildren.length}
                  </span>
                  <span>{formatBytes(activeNode?.sizeBytes)}</span>
                </div>
              </div>
              <div className="breadcrumb-bar" onWheelCapture={handleBreadcrumbWheel}>
                {breadcrumbItems.map((item, index) => (
                  <button
                    key={item.path}
                    type="button"
                    className="breadcrumb-item"
                    onClick={() => animateToPath(item.path)}
                  >
                    <span>{item.name}</span>
                    {index < breadcrumbItems.length - 1 ? <span className="breadcrumb-sep">/</span> : null}
                  </button>
                ))}
              </div>
              <div className="treemap-wrap" onWheelCapture={handleWheel}>
                {visibleNodes.length ? (
                  <ReactEChartsCore
                    ref={chartRef}
                    echarts={echarts}
                    option={treemapOption}
                    notMerge
                    lazyUpdate
                    style={{ height: "100%" }}
                    onEvents={chartEvents}
                  />
                ) : (
                  <div className="treemap-empty">{t("analysis.noItemsInFilter")}</div>
                )}
              </div>
            </div>

            <div className="stack-column">
              <div className="card">
                <div className="section-heading">
                  <h3>{t("analysis.spaceByType")}</h3>
                  <span>{typeStats.length} {t("hints.groups")}</span>
                </div>
                <div className="stat-list">
                  {typeStats.map((item) => (
                    <div key={item.label} className="stat-row">
                      <div className="stat-row-copy">
                        <strong>{item.label}</strong>
                        <span>{formatBytes(item.sizeBytes)}</span>
                      </div>
                      <div className="progress-track">
                        <div className={`progress-fill ${typeProgressTone(item.label)}`} style={{ width: `${Math.min(item.percentage || 0, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card folders-card">
                <div className="section-heading">
                  <h3>{t("analysis.foldersScope")}</h3>
                  <span>{folderRows.length} {t("hints.totalItems")}</span>
                </div>
                <div className="table-card-scroll">
                  <DataTable
                    columns={folderColumns}
                    rows={folderRows}
                    emptyText={t("analysis.noItemsInFilter")}
                    onRowClick={(row) => animateToPath(row.path)}
                    onRowEnter={(row) => highlightTreemapPath(row.name === ".." ? "" : row.path || "")}
                    onRowLeave={clearExternalTreemapHighlight}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="analysis-top-files-layout">
            <section className="card">
              <div className="section-heading">
                <h3 className="heading-with-icon"><Icon name="database" className="section-icon" />{t("analysis.topLargestFiles")}</h3>
                <span>{scopedTopFiles.length} {t("hints.totalItems")}</span>
              </div>
              <DataTable
                columns={topFileTableColumns}
                rows={topFilesPageRows}
                emptyText={t("analysis.noFilesInScope")}
                onRowClick={(row) => {
                  setSelectedTopFilePath(row.path);
                  setShowTopFilePreviewDetails(false);
                }}
              />
              <div className="pagination-row">
                <ActionButton tone="secondary" icon="chevron_left" disabled={topPage <= 0} onClick={() => setTopPage((current) => Math.max(0, current - 1))}>
                  {t("actions.previous")}
                </ActionButton>
                <div className="page-jump-group">
                  <span className="treemap-hint">{t("hints.page")}</span>
                  <input
                    className="page-jump-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={topPageInput}
                    onChange={(event) => setTopPageInput(event.target.value.replace(/\D+/g, ""))}
                    onBlur={(event) => jumpToTopPage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        jumpToTopPage(event.currentTarget.value);
                      }
                    }}
                  />
                  <span className="treemap-hint">/ {topFilesPageCount}</span>
                </div>
                <ActionButton
                  tone="secondary"
                  icon="chevron_right"
                  disabled={topPage >= topFilesPageCount - 1}
                  onClick={() => setTopPage((current) => Math.min(topFilesPageCount - 1, current + 1))}
                >
                  {t("actions.next")}
                </ActionButton>
              </div>
            </section>

            <aside className="card duplicates-preview-card analysis-top-preview-card">
              <div className="duplicates-preview-header">
                <div className="duplicates-preview-copy">
                  <h4>{locale === "en" ? "Preview" : "预览"}</h4>
                  <span>{selectedTopFile?.name || (locale === "en" ? "No file selected" : "未选择文件")}</span>
                </div>
                <div className="duplicates-preview-actions">
                  {selectedTopFile ? (
                    <button type="button" className="panel-toggle-button" onClick={() => handleCopyResolvedPath(selectedTopFile.path, selectedTopFile.hostPath)}>
                      {t("actions.copyPath")}
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedTopFile ? (
                <>
                  <div className="duplicates-preview-stage">
                    {topFilePreviewKind === "image" ? <img className="duplicates-preview-image" src={topFilePreviewURL} alt={selectedTopFile.name} /> : null}
                    {topFilePreviewKind === "video" ? (topFileMediaPreviewSupported
                      ? <video className="duplicates-preview-video" controls preload="metadata" src={topFilePreviewURL} />
                      : <div className="duplicates-preview-empty">{topFileMediaPreviewMessage}</div>) : null}
                    {topFilePreviewKind === "audio" ? (topFileMediaPreviewSupported
                      ? <audio className="duplicates-preview-audio" controls preload="metadata" src={topFilePreviewURL} />
                      : <div className="duplicates-preview-empty">{topFileMediaPreviewMessage}</div>) : null}
                    {topFilePreviewKind === "pdf" ? <iframe className="duplicates-preview-frame duplicates-preview-frame-pdf" src={topFilePreviewURL} title={selectedTopFile.name} /> : null}
                    {topFilePreviewKind === "text" ? (
                      topFilePreviewLoading ? <div className="duplicates-preview-empty">{locale === "en" ? "Loading preview..." : "正在加载预览..."}</div>
                      : topFilePreviewError ? <div className="duplicates-preview-empty">{topFilePreviewError}</div>
                      : topFilePreview?.kind === "archive-list"
                        ? <ArchivePreviewList entries={topFilePreview?.entries || []} locale={locale} />
                        : topFilePreview?.kind === "unsupported"
                          ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div>
                          : <TextPreviewContent content={topFilePreview?.content || ""} fileName={selectedTopFile?.name || ""} />
                    ) : null}
                    {topFilePreviewKind === "unsupported" ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div> : null}
                  </div>
                  <div className="duplicates-preview-meta">
                    <span className="duplicates-preview-size">{formatBytes(selectedTopFile.sizeBytes)}</span>
                    <button type="button" className="panel-toggle-button" onClick={() => setTopFilePreviewDialogOpen(true)}>
                      {locale === "en" ? "Expand Preview" : "放大预览"}
                    </button>
                    <button type="button" className="panel-toggle-button" onClick={() => setShowTopFilePreviewDetails((current) => !current)}>
                      {showTopFilePreviewDetails ? (locale === "en" ? "Hide Details" : "收起详情") : (locale === "en" ? "Show Details" : "展开详情")}
                    </button>
                    {topFilePreviewKind === "text" && topFilePreview?.truncated ? <span>{locale === "en" ? "Showing the first 64 KB" : "当前仅显示前 64 KB"}</span> : null}
                  </div>
                  {showTopFilePreviewDetails ? (
                    <div className="duplicates-preview-details">
                      <div className="duplicates-preview-detail"><span>{locale === "en" ? "Extension" : "扩展名"}</span><strong>{getExtensionLabel(selectedTopFile.name)}</strong></div>
                      <div className="duplicates-preview-detail"><span>{locale === "en" ? "Preview Type" : "预览类型"}</span><strong>{previewKindLabel(topFilePreviewKind, locale)}</strong></div>
                      <div className="duplicates-preview-detail"><span>{locale === "en" ? "Modified" : "修改时间"}</span><strong>{formatHistoryTime(selectedTopFile.modifiedAt) || "-"}</strong></div>
                      <div className="duplicates-preview-detail">
                        <span>{locale === "en" ? "Location" : "所在目录"}</span>
                        <strong className="duplicates-preview-path-value" title={selectedTopFile.displayParentPath || selectedTopFile.parentPath}>{selectedTopFile.displayParentPath || selectedTopFile.parentPath || "-"}</strong>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="duplicates-preview-empty">
                  {locale === "en" ? "Select a file to preview." : "选择一个文件进行预览。"}
                </div>
              )}
            </aside>
          </section>
        </>
      ) : null}

      <PreviewDialog
        item={selectedTopFile}
        locale={locale}
        mediaPreviewMessage={topFileMediaPreviewMessage}
        mediaPreviewSupported={topFileMediaPreviewSupported}
        onClose={() => setTopFilePreviewDialogOpen(false)}
        open={topFilePreviewDialogOpen}
        previewKind={topFilePreviewKind}
        previewRoot={topFilePreviewRoot}
      />

      {!job && !roots.loading && !roots.error && !restoringHistoryId ? (
        <EmptyState title={t("analysis.noAnalysisTitle")} description={t("analysis.noAnalysisDesc")} />
      ) : null}
      <FilePickerDialog
        open={Boolean(pickerState)}
        mode="folder"
        roots={roots.items}
        root={pickerRoot}
        browsePath={pickerBrowsePath}
        selectedPath={pickerState?.selectedPath || activePath || ""}
        ignoreList={scanIgnoreList}
        title={locale === "en" ? "Choose scan folder" : "选择扫描目录"}
        searchPlaceholder={locale === "en" ? "Search folders..." : "搜索目录..."}
        directories={pickerDirectories}
        onClose={() => setPickerState(null)}
        onConfirm={handlePickerConfirm}
        onRootChange={(root) => setPickerState((current) => ({
          ...current,
          root,
          browsePath: root,
          selectedPath: root
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

function mapTreemapNode(node, rootSize, siblingMaxSize, index, depth = 0, viewMode = "all", focusPath = "", scopeRootPath = "", treemapFileColorMode = "size", treemapDetailLevel = "medium") {
  const percentage = rootSize > 0 ? (node.sizeBytes / rootSize) * 100 : 0;
  const siblingPercentage = siblingMaxSize > 0 ? (node.sizeBytes / siblingMaxSize) * 100 : 100;
  const palette = pickPalette(node, percentage, siblingPercentage, depth, index, treemapFileColorMode);
  const maxLabelLength =
    siblingPercentage >= 55 ? 18
    : siblingPercentage >= 26 ? 14
    : siblingPercentage >= 12 ? 10
    : 8;
  const displayName = truncate(node.name, depth <= 0 ? Math.max(maxLabelLength, 18) : maxLabelLength);
  const sizeText = formatBytes(node.sizeBytes);
  const percentText = `${percentage.toFixed(1)}%`;
  const canRenderChildren = shouldRenderTreemapChildren(node, viewMode, focusPath);
  const canExpandChildren = shouldExpandTreemapNode(node, rootSize, viewMode, depth, focusPath, treemapDetailLevel);
  const canPrioritizeUpperLabel =
    depth === 0
      ? true
      : depth === 1
      ? (percentage >= 0.14 || siblingPercentage >= 1.4)
        : true;
  const childNodes = canRenderChildren && canExpandChildren && canPrioritizeUpperLabel
    ? buildTreemapChildren(node, viewMode, focusPath)
    : [];
  const expanded = childNodes.length > 0;
  const showFullLabel =
    node.type === "directory"
      ? depth <= 0
        ? (percentage >= 6 || siblingPercentage >= 24)
        : (percentage >= 4.5 && siblingPercentage >= 42)
      : depth <= 0
        ? (percentage >= 4.8 || siblingPercentage >= 18)
        : (percentage >= 2.8 && siblingPercentage >= 24);
  const showCompactLabel =
    node.type === "directory"
      ? (depth <= 1 ? (percentage >= 1.4 || siblingPercentage >= 10) : (percentage >= 1.1 || siblingPercentage >= 18))
      : (depth <= 1 ? (percentage >= 0.13 || siblingPercentage >= 1.05) : (percentage >= 0.12 || siblingPercentage >= 2.35));
  const showUpperLabel =
    expanded
    && depth >= 0
    && (
      depth <= 1
        ? depth === 0 || percentage >= 0.08 || siblingPercentage >= 0.75
        : (percentage >= 0.5 || siblingPercentage >= 9)
    );
  const compactDisplayName = truncate(displayName, depth <= 0 ? 18 : depth === 1 ? 10 : 6);
  const compactLabelText = compactDisplayName;
  const defaultBorderWidth =
    node.type === "directory"
      ? depth <= 1 ? 2.1 : depth === 2 ? 1.45 : 0.95
      : depth <= 1 ? 1.35 : 0.45;
  const safeLabelText =
    !showCompactLabel
      ? ""
      : showUpperLabel
        ? ""
        : showFullLabel
          ? `${displayName}\n${sizeText}\n${percentText}`
          : compactLabelText;
  const nestedMaxSize = expanded ? largestNodeSize(childNodes) : 1;
  return {
    id: node.path,
    name: node.name,
    displayName: displayName || node.name || node.path || "",
    value: Math.max(scaledTreemapValue(node.sizeBytes || 0, siblingMaxSize, depth), 1),
    rawSize: node.sizeBytes,
    percentText,
    upperLabelText: expanded ? `${displayName} ${percentText}` : "",
    labelText: safeLabelText,
    path: node.path,
    drillPath: node.type === "directory" ? node.path : parentPath(node.path, scopeRootPath || parentPath(node.path, "/")),
    isDir: node.type === "directory",
    itemStyle: {
      color: palette.fill,
      borderColor: palette.border,
      borderWidth: defaultBorderWidth,
      opacity: 1
    },
    emphasis: {
      focus: "none",
      itemStyle: {
        borderColor: "#2563eb",
        borderWidth: 1.4
      },
      label: {
        color: palette.text,
        backgroundColor: "transparent",
        show: true
      }
    },
    label: {
      color: palette.text,
      fontWeight: 700,
      show: showCompactLabel,
      overflow: "truncate",
      width: depth <= 0 ? 92 : depth === 1 ? 56 : 34,
      height: depth <= 1 ? 32 : 14,
      lineHeight: depth <= 1 ? 14 : 12
    },
    upperLabel: {
      show: showUpperLabel
    },
    children: expanded
      ? childNodes.map((child, childIndex) =>
          mapTreemapNode(
            child,
            rootSize,
            nestedMaxSize,
            childIndex,
            depth + 1,
            viewMode,
            focusPath,
            scopeRootPath,
            treemapFileColorMode,
            treemapDetailLevel
          )
        )
      : undefined
  };
}

function countTreemapNodes(nodes = []) {
  let total = 0;
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    total += 1;
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i += 1) {
      stack.push(children[i]);
    }
  }
  return total;
}

function treemapLabelFormatter(params) {
  return params?.data?.labelText || params?.data?.displayName || params?.name || "";
}

function treemapUpperLabelFormatter(params) {
  return params?.data?.upperLabelText || "";
}

function filterNodesForView(nodes = [], viewMode = "all") {
  return nodes.filter((item) => {
    if (viewMode === "folders") {
      return item.type === "directory";
    }
    if (viewMode === "files") {
      return item.type !== "directory";
    }
    return true;
  });
}

function sortNodesForView(nodes = [], viewMode = "all") {
  return filterNodesForView(nodes, viewMode).sort((a, b) => b.sizeBytes - a.sizeBytes);
}

function buildTreemapChildren(node, viewMode, focusPath = "") {
  if (node.type !== "directory") {
    return [];
  }
  const ordered = sortNodesForView(node.children ?? [], viewMode);
  const isOnFocusTrail = Boolean(focusPath) && (node.path === focusPath || focusPath.startsWith(`${node.path}/`));
  if (isOnFocusTrail) {
    return ordered;
  }
  if (ordered.length <= MAX_VISIBLE || node.sizeBytes <= 512 * 1024 * 1024) {
    return ordered;
  }
  const limited = ordered.slice(0, MAX_VISIBLE);
  if (!focusPath) {
    return limited;
  }
  let focusChild = null;
  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
    if (focusPath === item.path || focusPath.startsWith(`${item.path}/`)) {
      focusChild = item;
      break;
    }
  }
  if (!focusChild || limited.some((item) => item.path === focusChild.path)) {
    return limited;
  }
  const merged = limited.slice(0, Math.max(0, MAX_VISIBLE - 1));
  let insertAt = merged.findIndex((item) => focusChild.sizeBytes > item.sizeBytes);
  if (insertAt === -1) {
    insertAt = merged.length;
  }
  merged.splice(insertAt, 0, focusChild);
  return merged;
}

function shouldExpandTreemapNode(node, rootSize, viewMode, depth = 0, focusPath = "", treemapDetailLevel = "medium") {
  if (!node) {
    return false;
  }
  if (focusPath && node.type === "directory" && (focusPath === node.path || focusPath.startsWith(`${node.path}/`))) {
    return true;
  }
  if (node.type !== "directory") {
    return false;
  }
  const rootPercentage = rootSize > 0 ? (node.sizeBytes / rootSize) * 100 : 0;
  if (rootPercentage <= 0) {
    return false;
  }
  if (viewMode === "files") {
    return false;
  }
  const hasDirectFiles = (node.children ?? []).some((child) => child.type !== "directory");
  const detailThresholds = {
    simple: {
      depth2Files: 0.2,
      depth2Folders: 0.6,
      deepFiles: 0.35,
      deepFolders: 1.0
    },
    medium: {
      depth2Files: 0.1,
      depth2Folders: 0.35,
      deepFiles: 0.22,
      deepFolders: 0.75
    },
    detailed: {
      depth2Files: 0.04,
      depth2Folders: 0.18,
      deepFiles: 0.1,
      deepFolders: 0.35
    }
  };
  const thresholds = detailThresholds[treemapDetailLevel] || detailThresholds.medium;
  const depthCaps = {
    simple: 1,
    medium: 2,
    detailed: 3
  };
  const maxExpandedDepth = depthCaps[treemapDetailLevel] ?? depthCaps.medium;
  if (depth <= 1) {
    return true;
  }
  if (depth >= maxExpandedDepth) {
    return false;
  }
  if (depth === 2) {
    return rootPercentage >= (hasDirectFiles ? thresholds.depth2Files : thresholds.depth2Folders);
  }
  return rootPercentage >= (hasDirectFiles ? thresholds.deepFiles : thresholds.deepFolders);
}

function shouldRenderTreemapChildren(node, viewMode, focusPath = "") {
  if (!node) {
    return false;
  }
  if (focusPath && node.type === "directory" && (focusPath === node.path || focusPath.startsWith(`${node.path}/`))) {
    return true;
  }
  if (node.type !== "directory") {
    return false;
  }
  if (viewMode === "files") {
    return false;
  }
  if (!(node.children ?? []).length) {
    return false;
  }
  return true;
}

function scaledTreemapValue(size, siblingMaxSize, depth = 0) {
  const raw = Math.max(Number(size || 0), 1);
  const maxSize = Math.max(Number(siblingMaxSize || 0), raw);
  const ratio = raw / maxSize;
  const exponent = depth <= 0 ? 0.52 : depth === 1 ? 0.58 : 0.64;
  return Math.pow(ratio, exponent) * 100;
}

function largestNodeSize(nodes = []) {
  let maxSize = 1;
  for (let i = 0; i < nodes.length; i += 1) {
    maxSize = Math.max(maxSize, nodes[i]?.sizeBytes || 0);
  }
  return maxSize;
}

function resolveInitialAnalyzeDepth(requestedDepth) {
  if (requestedDepth > 0) {
    return Math.min(requestedDepth, ANALYSIS_CHUNK_DEPTH);
  }
  return ANALYSIS_CHUNK_DEPTH;
}

function resolveRemainingAnalyzeDepth(requestedDepth, currentDepth) {
  if (requestedDepth > 0) {
    return Math.max(0, Math.min(ANALYSIS_CHUNK_DEPTH, requestedDepth - currentDepth));
  }
  return ANALYSIS_CHUNK_DEPTH;
}

function mergeAnalysisTree(root, targetPath, replacementNode) {
  if (!root?.path || !targetPath || !replacementNode?.path) {
    return root;
  }
  if (root.path === targetPath) {
    return replacementNode;
  }
  if (!(root.children ?? []).length) {
    return root;
  }
  return {
    ...root,
    children: root.children.map((child) => {
      if (!child?.path) {
        return child;
      }
      if (child.path === targetPath) {
        return replacementNode;
      }
      if (!targetPath.startsWith(`${child.path}/`)) {
        return child;
      }
      return mergeAnalysisTree(child, targetPath, replacementNode);
    })
  };
}

function buildTreeIndexes(root) {
  const nodeIndex = new Map();
  const parentIndex = new Map();
  const depthIndex = new Map();
  if (!root) {
    return { nodeIndex, parentIndex, depthIndex };
  }
  const stack = [{ node: root, depth: 0 }];
  while (stack.length) {
    const currentEntry = stack.pop();
    const current = currentEntry?.node;
    const depth = currentEntry?.depth ?? 0;
    if (!current?.path || nodeIndex.has(current.path)) {
      continue;
    }
    nodeIndex.set(current.path, current);
    depthIndex.set(current.path, depth);
    const children = current.children ?? [];
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i];
      if (child?.path) {
        parentIndex.set(child.path, current.path);
      }
      stack.push({ node: child, depth: depth + 1 });
    }
  }
  return { nodeIndex, parentIndex, depthIndex };
}

function analyzeNodeFiles(node, limit = 0) {
  if (!node) {
    return { topFiles: [], typeStats: [] };
  }

  const topFiles = [];
  const totals = new Map();
  const walk = (current) => {
    for (const child of current.children ?? []) {
      if (child.type === "directory") {
        walk(child);
        continue;
      }

      const nextItem = {
        id: child.path,
        name: child.name,
        path: child.path,
        hostPath: child.hostPath,
        parentPath: parentPath(child.path, current.path || "/"),
        parentHostPath: parentPath(child.hostPath || "", current.hostPath || "/"),
        extension: child.name.includes(".") ? child.name.split(".").pop().toLowerCase() : "",
        sizeBytes: child.sizeBytes,
        modifiedAt: child.modifiedAt || "",
        isDir: false
      };

      if (!limit || limit <= 0) {
        topFiles.push(nextItem);
      } else {
        insertTopFile(topFiles, nextItem, limit);
      }

      const meta = getFileMeta(child.name, "", false);
      const label = {
        VIDEO: "视频",
        IMAGE: "图片",
        DOCUMENT: "文档",
        ARCHIVE: "压缩包",
        FILE: "其他"
      }[meta.label] || "其他";
      totals.set(label, (totals.get(label) || 0) + child.sizeBytes);
    }
  };

  walk(node);
  const totalSize = node.sizeBytes || 0;
  return {
    topFiles: topFiles.sort((a, b) => b.sizeBytes - a.sizeBytes),
    typeStats: [...totals.entries()].map(([label, sizeBytes]) => ({
      label,
      sizeBytes,
      percentage: totalSize > 0 ? (sizeBytes / totalSize) * 100 : 0
    }))
  };
}

function insertTopFile(items, nextItem, limit) {
  let insertAt = items.findIndex((item) => nextItem.sizeBytes > item.sizeBytes);
  if (insertAt === -1) {
    if (items.length >= limit) {
      return;
    }
    insertAt = items.length;
  }
  items.splice(insertAt, 0, nextItem);
  if (items.length > limit) {
    items.pop();
  }
}

function buildBreadcrumbs(root, activePath, parentIndex = new Map()) {
  if (!root) {
    return [];
  }
  if (!activePath || activePath === root.path) {
    return [{ name: root.name, path: root.path }];
  }
  const trailPaths = [];
  let currentPath = activePath;
  while (currentPath) {
    trailPaths.push(currentPath);
    if (currentPath === root.path) {
      break;
    }
    currentPath = parentIndex.get(currentPath);
  }
  if (trailPaths[trailPaths.length - 1] !== root.path) {
    return [{ name: root.name, path: root.path }];
  }
  const orderedPaths = trailPaths.reverse();
  return orderedPaths.map((path) => ({
    name: path === root.path ? root.name : pathLabel(path),
    path
  }));
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function pickPalette(node, percentage, siblingPercentage, depth, index = 0, treemapFileColorMode = "size") {
  if (node.type === "directory") {
    if (treemapFileColorMode === "size") {
      const rootStrength = Math.max(0, Math.min(1, percentage / 100));
      const siblingStrength = Math.max(0, Math.min(1, siblingPercentage / 100));
      const mix = Math.pow(siblingStrength, depth <= 1 ? 0.72 : 0.84);
      const hue =
        rootStrength >= 0.85 ? 348
        : rootStrength >= 0.68 ? 22
        : rootStrength >= 0.5 ? 42
        : rootStrength >= 0.32 ? 208
        : 214;
      const saturation =
        rootStrength >= 0.85 ? 68
        : rootStrength >= 0.68 ? 72
        : rootStrength >= 0.5 ? 74
        : rootStrength >= 0.32 ? 62
        : 24;
      const fillLightness = Math.round((rootStrength < 0.32 ? 92 : 89) - mix * (rootStrength < 0.32 ? 7 : 13));
      const borderLightness = Math.round((rootStrength < 0.32 ? 76 : 71) - mix * (rootStrength < 0.32 ? 8 : 15));
      const textLightness = Math.round((rootStrength < 0.32 ? 28 : 25) - mix * 6);
      return {
        fill: `hsl(${hue} ${saturation}% ${fillLightness}%)`,
        border: `hsl(${hue} ${Math.max(32, saturation - 10)}% ${borderLightness}%)`,
        text: `hsl(${hue} ${Math.max(28, saturation - 18)}% ${textLightness}%)`
      };
    }
    const fillVariants =
      depth <= 0
        ? ["#d8e7fb", "#dceafb", "#d5e5fb"]
        : depth === 1
          ? ["#e5f0ff", "#eaf3ff", "#e1edff"]
          : depth === 2
            ? ["#edf5ff", "#f1f7ff", "#eaf3ff"]
            : ["#f4f9ff", "#f7fbff", "#f1f7ff"];
    const borderVariants =
      depth <= 0
        ? ["#6ea4df", "#7aace2", "#649ddc"]
        : depth === 1
          ? ["#86b2e5", "#91b9e8", "#7daae1"]
          : depth === 2
            ? ["#9cc1e8", "#a6c8eb", "#92bae4"]
            : ["#b7d1ec", "#c0d7ef", "#adcbe8"];
    const textVariants =
      depth <= 0
        ? ["#194a80", "#24558a", "#184779"]
        : depth === 1
          ? ["#1f4f82", "#28598c", "#1d4a7b"]
          : depth === 2
            ? ["#335f90", "#3b6998", "#2d5888"]
            : ["#4a739c", "#527ca4", "#446b93"];
    const variantIndex = index % 3;
    return { fill: fillVariants[variantIndex], border: borderVariants[variantIndex], text: textVariants[variantIndex] };
  }

  if (treemapFileColorMode === "type") {
    const meta = getFileMeta(node.name || "", "", false);
    switch (meta.label) {
      case "VIDEO":
        return { fill: "#fee2e2", border: "#fca5a5", text: "#b91c1c" };
      case "IMAGE":
        return { fill: "#ede9fe", border: "#c4b5fd", text: "#6d28d9" };
      case "DOCUMENT":
        return { fill: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" };
      case "ARCHIVE":
        return { fill: "#ffedd5", border: "#fdba74", text: "#c2410c" };
      default:
        return percentage >= 6
          ? { fill: "#ecfdf5", border: "#86efac", text: "#166534" }
          : { fill: "#f3f4f6", border: "#d1d5db", text: "#4b5563" };
    }
  }

  const rootStrength = Math.max(0, Math.min(1, percentage / 100));
  const siblingStrength = Math.max(0, Math.min(1, siblingPercentage / 100));
  const mix = Math.pow(siblingStrength, depth <= 1 ? 0.68 : 0.8);
  const hue =
    rootStrength >= 0.85 ? 342
    : rootStrength >= 0.68 ? 18
    : rootStrength >= 0.5 ? 38
    : rootStrength >= 0.32 ? 212
    : 220;
  const saturation =
    rootStrength >= 0.85 ? 82
    : rootStrength >= 0.68 ? 88
    : rootStrength >= 0.5 ? 90
    : rootStrength >= 0.32 ? 84
    : 18;
  const fillLightness = Math.round((rootStrength < 0.32 ? 98 : 97) - mix * (rootStrength < 0.32 ? 6 : 16));
  const borderLightness = Math.round((rootStrength < 0.32 ? 88 : 86) - mix * (rootStrength < 0.32 ? 8 : 20));
  const textLightness = Math.round((rootStrength < 0.32 ? 34 : 36) - mix * (rootStrength < 0.32 ? 4 : 8));
  return {
    fill: `hsl(${hue} ${saturation}% ${fillLightness}%)`,
    border: `hsl(${hue} ${Math.max(52, saturation - 10)}% ${borderLightness}%)`,
    text: `hsl(${hue} ${Math.max(48, saturation - 18)}% ${textLightness}%)`
  };
}

function buildHistoryEntry(job, form) {
  const result = job?.result;
  if (!result?.tree?.path) {
    return null;
  }

  const savedAt = result.updatedAt || job.createdAt || new Date().toISOString();
  return {
    id: [savedAt, result.path || result.tree.path, form.maxDepth || 0, form.topN || 10].join("|"),
    savedAt,
    createdAt: job.createdAt || savedAt,
    root: result.root || form.root,
    path: result.path || form.path || result.tree.path,
    focusPath: result.path || form.path || result.tree.path,
    maxDepth: Number(form.maxDepth || 0),
    topN: Number(form.topN || 10),
    sizeBytes: Number(result.tree?.sizeBytes || 0),
    result
  };
}

function clearAnalysisState() {
  analysisStateStore.reset();
}

function typeProgressTone(label) {
  switch (label) {
    case "视频":
      return "progress-video";
    case "图片":
      return "progress-image";
    case "文档":
      return "progress-document";
    case "压缩包":
      return "progress-archive";
    default:
      return "progress-other";
  }
}

