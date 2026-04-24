import { memo } from "react";
import EmptyState from "../EmptyState";
import DuplicateGroupCard from "./DuplicateGroupCard";

function DuplicateResultsPanel({
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
  groupMenuRef,
  groups,
  handleCopyGroupPaths,
  handleIgnoreGroup,
  handleSkipGroup,
  hasCompletedResults,
  hasVisibleResults,
  inlineRenameLoading,
  inlineRenamePath,
  inlineRenameValue,
  invertGroupSelection,
  loadMoreRef,
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
  toggleSelectedPath,
  visibleGroupCount,
  visibleGroups
}) {
  return (
    <div className="duplicates-results-stack">
      {hasVisibleResults ? visibleGroups.map((group) => {
        return (
          <DuplicateGroupCard
            key={group.hash}
            allowFullGroupSelection={allowFullGroupSelection}
            applyQuickSelectionToGroup={applyQuickSelectionToGroup}
            beginInlineRename={beginInlineRename}
            cancelInlineRename={cancelInlineRename}
            clearGroupSelection={clearGroupSelection}
            displayPathName={displayPathName}
            ensureTrailingSlash={ensureTrailingSlash}
            findSharedFolderPaths={findSharedFolderPaths}
            formatBytes={formatBytes}
            formatDate={formatDate}
            getKeeperPath={getKeeperPath}
            group={group}
            groupMenuRef={groupMenuRef}
            handleCopyGroupPaths={handleCopyGroupPaths}
            handleIgnoreGroup={handleIgnoreGroup}
            handleSkipGroup={handleSkipGroup}
            inlineRenameLoading={inlineRenameLoading}
            inlineRenamePath={inlineRenamePath}
            inlineRenameValue={inlineRenameValue}
            invertGroupSelection={invertGroupSelection}
            locale={locale}
            openGroupMenuHash={openGroupMenuHash}
            reflinkedPathSet={reflinkedPathSet}
            resolveDisplayPath={resolveDisplayPath}
            selectedFilePath={selectedFilePath}
            selectedPathSet={selectedPathSet}
            setInlineRenameValue={setInlineRenameValue}
            setOpenGroupMenuHash={setOpenGroupMenuHash}
            setSelectedFilePath={setSelectedFilePath}
            submitInlineRename={submitInlineRename}
            t={t}
            toast={toast}
            toggleFullGroupSelection={toggleFullGroupSelection}
            toggleSelectedPath={toggleSelectedPath}
          />
        );
      }) : (
        <EmptyState
          title={hasCompletedResults
            ? (locale === "en" ? "No matching duplicate files" : "当前筛选没有匹配的重复文件")
            : t("duplicates.emptyTitle")}
          description={hasCompletedResults
            ? (locale === "en" ? "Clear the search or filters to view the remaining duplicate groups." : "清空搜索或筛选条件后，可恢复查看其余未处理的重复文件组。")
            : t("duplicates.empty")}
        />
      )}
      {hasVisibleResults && visibleGroupCount < groups.length ? (
        <div ref={loadMoreRef} className="duplicates-load-more">
          <span>{locale === "en" ? `Rendering ${visibleGroups.length} / ${groups.length} groups` : `当前已渲染 ${visibleGroups.length} / ${groups.length} 组`}</span>
          <strong>{locale === "en" ? "Scroll to load more" : "继续向下滚动以加载更多"}</strong>
        </div>
      ) : null}
    </div>
  );
}

export default memo(DuplicateResultsPanel);
