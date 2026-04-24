import { memo } from "react";
import Icon from "../Icon";

function DuplicateBulkActionBar({
  actionLoading,
  activeRootWritable,
  applyComparedFolderSelection,
  applyQuickSelectionToVisibleGroups,
  duplicateActions,
  groups,
  ignoredGroupEntriesForView,
  locale,
  onClearSelectedPaths,
  onClearSkippedGroups,
  requestDuplicateAction,
  scanMode,
  selectedPaths,
  selectionSummary,
  skippedGroupKeys,
  t,
  top
}) {
  return (
    <section className="duplicates-bulk-bar is-floating" style={{ top: `${top}px` }}>
      <div className="duplicates-bulk-main">
        <div className="duplicates-bulk-copy">
          <span>
            {selectedPaths.length
              ? (locale === "en" ? (
                <>
                  <span className="duplicates-summary-highlight">{selectionSummary.files}</span>
                  <span>{` duplicate copy files selected across ${selectionSummary.groups} groups`}</span>
                </>
              ) : (
                <>
                  <span>{`已选择 `}</span>
                  <span className="duplicates-summary-highlight">{selectionSummary.files}</span>
                  <span>{` 个副本文件，来自 ${selectionSummary.groups} 组`}</span>
                </>
              ))
              : (locale === "en" ? "No duplicate copy files selected yet." : "当前还没有勾选重复副本文件。")}
          </span>
          {skippedGroupKeys.length || ignoredGroupEntriesForView.length ? (
            <span>
              {locale === "en"
                ? `${skippedGroupKeys.length} skipped groups, ${ignoredGroupEntriesForView.length} ignored groups hidden`
                : `已隐藏 ${skippedGroupKeys.length} 个跳过分组、${ignoredGroupEntriesForView.length} 个忽略分组`}
            </span>
          ) : null}
          {!activeRootWritable ? <em>{t("duplicates.readOnlyHint")}</em> : null}
        </div>
        <div className="duplicates-bulk-control-stack">
          <div className="duplicates-bulk-actions">
            {scanMode === "folders" ? (
              <>
                <button type="button" className="duplicates-bulk-button" onClick={() => applyComparedFolderSelection("left")} disabled={Boolean(actionLoading) || !groups.length}>
                  <Icon name="folder_copy" />
                  <span>{locale === "en" ? "Select Compare Folder 1" : "勾选对比目录1"}</span>
                </button>
                <button type="button" className="duplicates-bulk-button" onClick={() => applyComparedFolderSelection("right")} disabled={Boolean(actionLoading) || !groups.length}>
                  <Icon name="folder_copy" />
                  <span>{locale === "en" ? "Select Compare Folder 2" : "勾选对比目录2"}</span>
                </button>
              </>
            ) : null}
            <button type="button" className="duplicates-bulk-button" onClick={onClearSelectedPaths} disabled={Boolean(actionLoading) || !selectedPaths.length}>
              <Icon name="deselect" />
              <span>{locale === "en" ? "Clear Selection" : "清除勾选"}</span>
            </button>
            <button type="button" className="duplicates-bulk-button" onClick={onClearSkippedGroups} disabled={Boolean(actionLoading) || !skippedGroupKeys.length}>
              <Icon name="playlist_add" />
              <span>{locale === "en" ? "Restore Skipped" : "恢复跳过组"}</span>
            </button>
            <button type="button" className="duplicates-bulk-button" onClick={() => applyQuickSelectionToVisibleGroups("first")} disabled={Boolean(actionLoading) || !groups.length}>
              <Icon name="first_page" />
              <span>{locale === "en" ? "Keep First" : "保留第一项"}</span>
            </button>
            <button type="button" className="duplicates-bulk-button" onClick={() => applyQuickSelectionToVisibleGroups("last")} disabled={Boolean(actionLoading) || !groups.length}>
              <Icon name="last_page" />
              <span>{locale === "en" ? "Keep Last" : "保留最后一项"}</span>
            </button>
            <button type="button" className="duplicates-bulk-button" onClick={() => applyQuickSelectionToVisibleGroups("newest")} disabled={Boolean(actionLoading) || !groups.length}>
              <Icon name="schedule" />
              <span>{locale === "en" ? "Keep Newest" : "保留较新"}</span>
            </button>
            <button type="button" className="duplicates-bulk-button" onClick={() => applyQuickSelectionToVisibleGroups("oldest")} disabled={Boolean(actionLoading) || !groups.length}>
              <Icon name="history" />
              <span>{locale === "en" ? "Keep Oldest" : "保留较旧"}</span>
            </button>
          </div>
          <div className="duplicates-bulk-actions duplicates-bulk-actions-primary">
            {duplicateActions.map((action) => (
              <button key={action.key} type="button" className={`duplicates-bulk-button ${actionLoading === action.key ? "is-active" : ""}`} onClick={() => requestDuplicateAction(action.key)} disabled={Boolean(actionLoading) || !activeRootWritable || !selectedPaths.length}>
                <Icon name={action.icon} />
                <span>{actionLoading === action.key ? `${t(action.labelKey)}...` : t(action.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(DuplicateBulkActionBar);
