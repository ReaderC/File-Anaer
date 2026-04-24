import { memo, useMemo } from "react";
import Icon from "../Icon";
import DuplicateFileRow from "./DuplicateFileRow";
import DuplicateGroupMenu from "./DuplicateGroupMenu";
import { getFileMeta } from "../../lib/fileMeta";

function DuplicateGroupCard({
  allowFullGroupSelection,
  applyQuickSelectionToGroup,
  beginInlineRename,
  cancelInlineRename,
  clearGroupSelection,
  displayPathName,
  ensureTrailingSlash,
  findSharedFolderPaths,
  formatBytes,
  formatDate,
  getKeeperPath,
  group,
  groupMenuRef,
  handleCopyGroupPaths,
  handleIgnoreGroup,
  handleSkipGroup,
  inlineRenameLoading,
  inlineRenamePath,
  inlineRenameValue,
  invertGroupSelection,
  locale,
  openGroupMenuHash,
  reflinkedPathSet,
  resolveDisplayPath,
  selectedFilePath,
  selectedPathSet,
  setInlineRenameValue,
  setOpenGroupMenuHash,
  setSelectedFilePath,
  submitInlineRename,
  t,
  toast,
  toggleFullGroupSelection,
  toggleSelectedPath
}) {
  const primaryFile = group.files[0];
  const meta = useMemo(() => getFileMeta(primaryFile?.name ?? "", "", false), [primaryFile?.name]);
  const selectedCount = useMemo(
    () => group.files.reduce((count, file) => count + (selectedPathSet.has(file.path) ? 1 : 0), 0),
    [group.files, selectedPathSet]
  );
  const hasSelectionInGroup = selectedCount > 0;
  const keeperPath = useMemo(
    () => (hasSelectionInGroup ? getKeeperPath(group, selectedPathSet) : ""),
    [getKeeperPath, group, hasSelectionInGroup, selectedPathSet]
  );
  const sharedFolderPaths = useMemo(
    () => findSharedFolderPaths(group.files, resolveDisplayPath),
    [findSharedFolderPaths, group.files, resolveDisplayPath]
  );
  const isFullGroupSelected = selectedCount === group.files.length;
  const uncheckedCount = group.files.length - selectedCount;

  return (
    <article className={`duplicates-group-shell ${openGroupMenuHash === group.hash ? "is-menu-open" : ""}`}>
      <div className="duplicates-group-header">
        <div className="duplicates-group-copy">
          <div className={`duplicates-group-icon tone-${meta.tone}`}><Icon name={meta.icon} fallback={false} /></div>
          <div>
            <h3>{primaryFile?.name || group.hash}</h3>
            <div className="duplicates-group-meta"><span>{group.fileCount} {t("duplicates.filesPerGroup")}</span><span className="duplicates-summary-sep">·</span><span>{t("duplicates.eachSize", { size: formatBytes(group.sizeBytes) })}</span></div>
          </div>
        </div>
        <div className="duplicates-group-actions">
          {allowFullGroupSelection ? (
            <button
              type="button"
              className="panel-toggle-button"
              onClick={() => toggleFullGroupSelection(group)}
            >
              {isFullGroupSelected
                ? (locale === "en" ? "Clear Group" : "取消当前组")
                : (locale === "en" ? "Select Group" : "选中当前组")}
            </button>
          ) : null}
          <DuplicateGroupMenu
            allowFullGroupSelection={allowFullGroupSelection}
            applyQuickSelectionToGroup={applyQuickSelectionToGroup}
            clearGroupSelection={clearGroupSelection}
            group={group}
            groupMenuRef={groupMenuRef}
            handleCopyGroupPaths={handleCopyGroupPaths}
            handleIgnoreGroup={handleIgnoreGroup}
            handleSkipGroup={handleSkipGroup}
            invertGroupSelection={invertGroupSelection}
            isFullGroupSelected={isFullGroupSelected}
            locale={locale}
            open={openGroupMenuHash === group.hash}
            setOpenGroupMenuHash={setOpenGroupMenuHash}
            toggleFullGroupSelection={toggleFullGroupSelection}
          />
          <div className="duplicates-group-size"><strong>{formatBytes(group.wastedBytes)}</strong><span>{t("duplicates.wastedSpace")}</span></div>
        </div>
      </div>
      <div className="duplicates-table-shell">
        <div className="duplicates-table-head"><span>{t("labels.path")}</span><span>{t("labels.modified")}</span><span>{t("labels.size")}</span><span>{locale === "en" ? "Edit" : "编辑"}</span><span>{t("labels.select")}</span></div>
        <div className="duplicates-table-body">
          {group.files.map((file) => {
            const isChecked = selectedPathSet.has(file.path);
            const displayParentPath = resolveDisplayPath(file.parentPath, file.parentHostPath);
            const displayFileName = displayPathName(file, displayParentPath);
            const sharedFolderColor = sharedFolderPaths.get(displayParentPath) || "";
            return (
              <DuplicateFileRow
                key={file.path}
                allowFullGroupSelection={allowFullGroupSelection}
                beginInlineRename={beginInlineRename}
                cancelInlineRename={cancelInlineRename}
                displayFileName={displayFileName}
                displayParentPath={displayParentPath}
                ensureTrailingSlash={ensureTrailingSlash}
                file={file}
                formatBytes={formatBytes}
                formatDate={formatDate}
                group={group}
                hasSelectionInGroup={hasSelectionInGroup}
                inlineRenameLoading={inlineRenameLoading}
                inlineRenamePath={inlineRenamePath}
                inlineRenameValue={inlineRenameValue}
                isChecked={isChecked}
                keeperPath={keeperPath}
                locale={locale}
                reflinkedPathSet={reflinkedPathSet}
                resolveDisplayPath={resolveDisplayPath}
                selectedFilePath={selectedFilePath}
                setInlineRenameValue={setInlineRenameValue}
                setSelectedFilePath={setSelectedFilePath}
                sharedFolderColor={sharedFolderColor}
                submitInlineRename={submitInlineRename}
                t={t}
                toast={toast}
                toggleSelectedPath={toggleSelectedPath}
                uncheckedCount={uncheckedCount}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}

function isSelectionStateEqual(prevProps, nextProps) {
  const files = prevProps.group.files;
  if (files.length !== nextProps.group.files.length) {
    return false;
  }
  for (const file of files) {
    const prevSelected = prevProps.selectedPathSet.has(file.path);
    const nextSelected = nextProps.selectedPathSet.has(file.path);
    if (prevSelected !== nextSelected) {
      return false;
    }
    const prevReflinked = prevProps.reflinkedPathSet.has(file.path);
    const nextReflinked = nextProps.reflinkedPathSet.has(file.path);
    if (prevReflinked !== nextReflinked) {
      return false;
    }
    const prevFocused = prevProps.selectedFilePath === file.path;
    const nextFocused = nextProps.selectedFilePath === file.path;
    if (prevFocused !== nextFocused) {
      return false;
    }
  }
  return true;
}

function areEqual(prevProps, nextProps) {
  if (prevProps.group !== nextProps.group) return false;
  if (prevProps.openGroupMenuHash === prevProps.group.hash || nextProps.openGroupMenuHash === nextProps.group.hash) {
    if (prevProps.openGroupMenuHash !== nextProps.openGroupMenuHash) return false;
  }
  if (prevProps.inlineRenamePath !== nextProps.inlineRenamePath) {
    const paths = new Set(prevProps.group.files.map((file) => file.path));
    if (paths.has(prevProps.inlineRenamePath) || paths.has(nextProps.inlineRenamePath)) {
      return false;
    }
  }
  if (prevProps.inlineRenameValue !== nextProps.inlineRenameValue && prevProps.inlineRenamePath && prevProps.inlineRenamePath === nextProps.inlineRenamePath) {
    const paths = new Set(prevProps.group.files.map((file) => file.path));
    if (paths.has(prevProps.inlineRenamePath)) {
      return false;
    }
  }
  if (prevProps.inlineRenameLoading !== nextProps.inlineRenameLoading) {
    const paths = new Set(prevProps.group.files.map((file) => file.path));
    if (paths.has(prevProps.inlineRenameLoading) || paths.has(nextProps.inlineRenameLoading)) {
      return false;
    }
  }
  if (
    prevProps.allowFullGroupSelection !== nextProps.allowFullGroupSelection ||
    prevProps.locale !== nextProps.locale
  ) {
    return false;
  }
  return isSelectionStateEqual(prevProps, nextProps);
}

export default memo(DuplicateGroupCard, areEqual);
