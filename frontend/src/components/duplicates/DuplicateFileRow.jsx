import { memo } from "react";
import Icon from "../Icon";

function DuplicateFileRow({
  allowFullGroupSelection,
  beginInlineRename,
  cancelInlineRename,
  displayFileName,
  displayParentPath,
  ensureTrailingSlash,
  file,
  formatBytes,
  formatDate,
  hasSelectionInGroup,
  inlineRenameLoading,
  inlineRenamePath,
  inlineRenameValue,
  isChecked,
  keeperPath,
  locale,
  reflinkedPathSet,
  resolveDisplayPath,
  selectedFilePath,
  setInlineRenameValue,
  setSelectedFilePath,
  sharedFolderColor,
  submitInlineRename,
  t,
  toast,
  toggleSelectedPath,
  uncheckedCount,
  group
}) {
  const isLockedKeeper = !allowFullGroupSelection && hasSelectionInGroup && uncheckedCount === 1 && file.path === keeperPath && !isChecked;
  const isInlineRenaming = inlineRenamePath === file.path;

  return (
    <div
      className={`duplicates-table-row ${hasSelectionInGroup && file.path === keeperPath ? "is-primary" : ""} ${selectedFilePath === file.path ? "is-selected" : ""}`}
      onClick={() => setSelectedFilePath(file.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedFilePath(file.path);
        }
      }}
    >
      <div className="duplicates-path-cell">
        <div className="file-title" title={resolveDisplayPath(file.path, file.hostPath)}>
          {!isInlineRenaming && displayParentPath ? (
            <span
              className={`duplicates-path-directory ${sharedFolderColor ? "is-shared-folder" : ""}`}
              style={sharedFolderColor ? { "--shared-folder-color": sharedFolderColor } : undefined}
            >
              {ensureTrailingSlash(displayParentPath)}
            </span>
          ) : null}
          {isInlineRenaming ? (
            <input
              className="duplicates-inline-rename-input"
              value={inlineRenameValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setInlineRenameValue(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitInlineRename(group, file);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelInlineRename();
                }
              }}
              autoFocus
            />
          ) : (
            <span className="duplicates-path-name">{displayFileName}</span>
          )}
        </div>
        <div className="duplicates-file-badges">
          {hasSelectionInGroup && file.path === keeperPath ? <span className="duplicates-primary-badge">{t("duplicates.keeperCandidate")}</span> : null}
          {reflinkedPathSet.has(file.path) ? (
            <span className="duplicates-reflink-badge" title={t("duplicates.reflinkBadgeTooltip")}>
              {t("duplicates.reflinkBadge")}
            </span>
          ) : null}
        </div>
      </div>
      <div>{formatDate(file.modifiedAt)}</div>
      <div>{formatBytes(file.sizeBytes)}</div>
      <div className="duplicates-inline-rename-actions">
        {isInlineRenaming ? (
          <>
            <button
              type="button"
              className="duplicates-inline-rename-button is-primary"
              onClick={(event) => {
                event.stopPropagation();
                submitInlineRename(group, file);
              }}
              disabled={inlineRenameLoading === file.path}
              title={locale === "en" ? "Save rename" : "保存重命名"}
              aria-label={locale === "en" ? "Save rename" : "保存重命名"}
            >
              <Icon name={inlineRenameLoading === file.path ? "progress_activity" : "check"} />
            </button>
            <button
              type="button"
              className="duplicates-inline-rename-button"
              onClick={(event) => {
                event.stopPropagation();
                cancelInlineRename();
              }}
              disabled={inlineRenameLoading === file.path}
              title={locale === "en" ? "Cancel rename" : "取消重命名"}
              aria-label={locale === "en" ? "Cancel rename" : "取消重命名"}
            >
              <Icon name="close" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="duplicates-inline-rename-button"
            onClick={(event) => {
              event.stopPropagation();
              beginInlineRename(file);
            }}
            title={locale === "en" ? "Rename file" : "重命名文件"}
            aria-label={locale === "en" ? "Rename file" : "重命名文件"}
          >
            <Icon name="edit" />
          </button>
        )}
      </div>
      <div className="duplicates-select-cell">
        <button
          type="button"
          className={`duplicates-checkbox-shell ${isLockedKeeper ? "is-disabled" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            if (isLockedKeeper) {
              toast.showToast(t("messages.duplicateGroupKeepRequired"));
              return;
            }
            toggleSelectedPath(file.path, group);
          }}
          aria-label={t("labels.select")}
        >
          <input
            type="checkbox"
            className="duplicates-checkbox"
            checked={isChecked}
            disabled={isLockedKeeper}
            onChange={() => {}}
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

export default memo(DuplicateFileRow);
