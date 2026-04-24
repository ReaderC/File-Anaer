import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { runSearch } from "../api/client";
import Icon from "./Icon";
import { getFileMeta } from "../lib/fileMeta";
import { useI18n } from "../lib/i18n.jsx";
import { pathLabel } from "../lib/pathUtils";
import { isIgnoredPath } from "../lib/settingsStore";

export default function FilePickerDialog({
  open,
  mode = "folder",
  roots = [],
  root,
  browsePath,
  selectedPath,
  ignoreList = [],
  title,
  searchPlaceholder,
  directories,
  onClose,
  onConfirm,
  onRootChange,
  onBrowsePathChange
}) {
  const { locale } = useI18n();
  const [draftPath, setDraftPath] = useState(selectedPath || browsePath || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState({ loading: false, error: "", items: [] });

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftPath(selectedPath || browsePath || root || "");
    setSearchQuery("");
    setSearchState({ loading: false, error: "", items: [] });
  }, [open, root, selectedPath]);

  useEffect(() => {
    if (!open || mode !== "folder") {
      return;
    }
    setDraftPath((current) => {
      if (!current || current === selectedPath || current === root) {
        return browsePath || root || "";
      }
      return current;
    });
  }, [browsePath, mode, open, root, selectedPath]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !searchQuery.trim() || !root) {
      setSearchState((current) => (current.loading || current.error || current.items.length ? { loading: false, error: "", items: [] } : current));
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchState({ loading: true, error: "", items: [] });
      try {
        const result = await runSearch({
          root,
          path: root,
          query: searchQuery.trim(),
          extensions: [],
          ignore: ignoreList,
          includeHidden: true,
          sizeMin: 0,
          sizeMax: 0,
          modifiedAfter: "",
          modifiedBefore: "",
          limit: 60,
          offset: 0
        });
        if (cancelled) {
          return;
        }
        const items = (result.items || []).filter((item) => (mode === "folder" ? item.isDir : true));
        setSearchState({ loading: false, error: "", items });
      } catch (error) {
        if (!cancelled) {
          setSearchState({ loading: false, error: error.message, items: [] });
        }
      }
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ignoreList, mode, open, root, searchQuery]);

  const quickAccessItems = useMemo(
    () => roots.map((item) => ({
      key: item.path,
      label: pathLabel(item.path) || item.path,
      path: item.path
    })),
    [roots]
  );

  const currentPath = directories.currentPath || browsePath || root || "";
  const quickAccessLabel = locale === "en" ? "Quick Access" : "快速访问";
  const loadingLabel = locale === "en" ? "Loading..." : "加载中...";
  const emptyLabel = locale === "en" ? "No items." : "暂无内容。";
  const cancelLabel = locale === "en" ? "Cancel" : "取消";
  const selectLabel = locale === "en" ? "Select" : "选择";
  const refreshLabel = locale === "en" ? "Refresh" : "刷新";
  const breadcrumbItems = useMemo(() => buildBreadcrumbItems(root, currentPath), [currentPath, root]);
  const listItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchState.items.map((item) => ({
        key: item.path,
        path: item.path,
        hostPath: item.hostPath || "",
        label: item.name || pathLabel(item.path),
        meta: item.parentPath,
        isDir: item.isDir
      })).filter((item) => !isIgnoredEntry(item, ignoreList));
    }
    return (directories.items || [])
      .filter((item) => (mode === "folder" ? item.isDir : true))
      .filter((item) => !isIgnoredEntry(item, ignoreList))
      .map((item) => ({
        key: item.path,
        path: item.path,
        hostPath: item.hostPath || "",
        label: item.name || pathLabel(item.path),
        meta: item.isDir ? item.path : item.path.replace(/[\\/][^\\/]+$/, ""),
        isDir: item.isDir
      }));
  }, [directories.items, ignoreList, mode, searchQuery, searchState.items]);

  const draftItem = listItems.find((item) => item.path === draftPath) || null;
  const draftIgnored = draftItem
    ? isIgnoredEntry(draftItem, ignoreList)
    : isIgnoredPath(draftPath, ignoreList);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="file-picker-backdrop" onClick={onClose}>
      <section className="file-picker-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="file-picker-header">
          <div>
            <h3>{title}</h3>
          </div>
          <div className="file-picker-header-tools">
            <button
              type="button"
              className="file-picker-refresh-button"
              onClick={() => directories.refresh?.()}
              disabled={directories.loading}
              title={refreshLabel}
            >
              <Icon name="refresh" />
              <span>{refreshLabel}</span>
            </button>
            <div className="file-picker-search">
              <Icon name="search" />
              <input
                value={searchQuery}
                placeholder={searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </header>
        <div className="file-picker-layout">
          <aside className="file-picker-sidebar">
            <span className="file-picker-sidebar-label">{quickAccessLabel}</span>
            <div className="file-picker-quick-list">
              {quickAccessItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`file-picker-quick-item ${root === item.path ? "is-active" : ""}`}
                  onClick={() => {
                    onRootChange(item.path);
                    onBrowsePathChange(item.path);
                    setDraftPath(item.path);
                    setSearchQuery("");
                  }}
                >
                  <Icon name="folder" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </aside>
          <main className="file-picker-main">
            <div className="breadcrumb-bar file-picker-breadcrumb" onWheelCapture={handleBreadcrumbWheel}>
              {breadcrumbItems.map((item, index) => (
                <button
                  key={item.path}
                  type="button"
                  className="breadcrumb-item"
                  onClick={() => {
                    onBrowsePathChange(item.path);
                    if (mode === "folder") {
                      setDraftPath(item.path);
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {index < breadcrumbItems.length - 1 ? <span className="breadcrumb-sep">/</span> : null}
                </button>
              ))}
            </div>
            <div className="file-picker-list">
              {directories.loading || searchState.loading ? <div className="file-picker-empty">{loadingLabel}</div> : null}
              {directories.error || searchState.error ? <div className="file-picker-empty">{directories.error || searchState.error}</div> : null}
              {!directories.loading && !searchState.loading && !(directories.error || searchState.error) ? listItems.map((item) => {
                const meta = getFileMeta(item.label, "", item.isDir);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`file-picker-row ${draftPath === item.path ? "is-active" : ""}`}
                    onClick={() => setDraftPath(item.path)}
                    onDoubleClick={() => {
                      if (item.isDir && !searchQuery.trim()) {
                        onBrowsePathChange(item.path);
                        if (mode === "folder") {
                          setDraftPath(item.path);
                        }
                        return;
                      }
                      if (isIgnoredEntry(item, ignoreList)) {
                        return;
                      }
                      setDraftPath(item.path);
                      onConfirm(item.path);
                    }}
                  >
                    <Icon name={meta.icon} className={`file-picker-row-icon tone-${meta.tone}`} />
                    <span className="file-picker-row-copy">
                      <strong>{item.label}</strong>
                      <small title={item.meta}>{item.meta}</small>
                    </span>
                  </button>
                );
              }) : null}
              {!directories.loading && !searchState.loading && !listItems.length && !(directories.error || searchState.error) ? (
                <div className="file-picker-empty">{emptyLabel}</div>
              ) : null}
            </div>
          </main>
        </div>
        <footer className="file-picker-footer">
          <div className="file-picker-actions">
            <button type="button" className="file-picker-action-button is-secondary" onClick={onClose}>
              {cancelLabel}
            </button>
            <button type="button" className="file-picker-action-button is-primary" onClick={() => onConfirm(draftPath)} disabled={!draftPath || draftIgnored}>
              {selectLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function isIgnoredEntry(item, ignoreList) {
  return isIgnoredPath(item?.path, ignoreList) || isIgnoredPath(item?.hostPath, ignoreList);
}

function buildBreadcrumbItems(rootPath, currentPath) {
  if (!rootPath || !currentPath) {
    return [];
  }
  const rootParts = splitPath(rootPath);
  const currentParts = splitPath(currentPath);
  const items = [];
  for (let index = 0; index < currentParts.length; index += 1) {
    const path = `/${currentParts.slice(0, index + 1).join("/")}`;
    if (index < rootParts.length - 1) {
      continue;
    }
    items.push({
      path,
      label: currentParts[index] || rootPath
    });
  }
  return items.length ? items : [{ path: rootPath, label: pathLabel(rootPath) || rootPath }];
}

function splitPath(value) {
  return String(value || "").replace(/\\/g, "/").split("/").filter(Boolean);
}

function handleBreadcrumbWheel(event) {
  const container = event.currentTarget;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  container.scrollLeft += event.deltaY;
}
