import { memo } from "react";
import { formatBytes } from "../../lib/format";

const DUPLICATE_RENAME_OPTIONS = [
  { key: "keeper", labelKey: "duplicates.renameUseKeeper" },
  { key: "manual", labelKey: "duplicates.renameManual" }
];

const DUPLICATE_RENAME_SCOPES = [
  { key: "copies", labelKey: "duplicates.renameCopiesOnly" },
  { key: "group", labelKey: "duplicates.renameWholeGroup" }
];

function DuplicateActionConfirmDialog({
  confirmState,
  hasFullSelection,
  locale,
  onChange,
  onClose,
  onConfirm,
  onPreview,
  selectedFileCount,
  selectionSummary,
  t,
  title,
  confirmMessage
}) {
  if (!confirmState) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-copy">
          <h3>{title}</h3>
          <p>
            {confirmMessage}
            {" "}
            {locale === "en"
              ? `${selectedFileCount} duplicate copy files are currently selected.`
              : `当前共勾选 ${selectedFileCount} 个重复副本文件。`}
          </p>
          {confirmState.mode === "reflink" ? (
            <p>
              <strong>{t("duplicates.reflinkWarningTitle")}:</strong>
              {" "}
              {t("duplicates.reflinkWarningBody")}
            </p>
          ) : null}
          {confirmState.mode === "rename" ? (
            <div className="duplicates-rename-form">
              <div className="duplicates-filter-group">
                <span className="duplicates-filter-label">{t("duplicates.renameScope")}:</span>
                <div className="duplicates-chip-row">
                  {DUPLICATE_RENAME_SCOPES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`duplicates-chip ${confirmState.renameScope === item.key ? "is-active" : ""}`}
                      onClick={() => onChange({ renameScope: item.key })}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="duplicates-filter-group">
                <span className="duplicates-filter-label">{t("duplicates.renameMode")}:</span>
                <div className="duplicates-chip-row">
                  {DUPLICATE_RENAME_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`duplicates-chip ${confirmState.renameMode === item.key ? "is-active" : ""}`}
                      onClick={() => onChange({ renameMode: item.key })}
                    >
                      {t(item.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              {confirmState.renameMode === "manual" ? (
                <label className="duplicates-rename-input">
                  <span className="duplicates-filter-label">{t("duplicates.renameInputLabel")}:</span>
                  <input
                    value={confirmState.renameName}
                    onChange={(event) => onChange({ renameName: event.target.value })}
                    placeholder={t("duplicates.renameInputPlaceholder")}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {confirmState.mode === "rename" && selectionSummary.groups > 1 ? (
            <p>
              {confirmState.renameScope === "group" && confirmState.renameMode === "manual"
                ? (locale === "en"
                  ? `${selectionSummary.groups} duplicate groups are selected. Every file in those groups will be renamed to the unified name, and same-folder conflicts will be suffixed automatically.`
                  : `当前已选中 ${selectionSummary.groups} 组重复文件。确认后，这些组内所有文件都会按统一名称重命名；同目录重名时系统会自动追加序号。`)
                : (locale === "en"
                  ? `${selectionSummary.groups} duplicate groups are selected. The current rename rule will be applied to all of them.`
                  : `当前已选中 ${selectionSummary.groups} 组重复文件。确认后，这些组都会按当前重命名规则统一处理。`)}
            </p>
          ) : null}
          {hasFullSelection ? (
            <p>{t("messages.duplicateFullSelectionRiskEnabled")}</p>
          ) : null}
          <p>{t("duplicates.dryRunNote")}</p>
          {confirmState.previewError ? (
            <div className="duplicates-preview-empty compact duplicates-preview-inline-error">
              {confirmState.previewError}
            </div>
          ) : null}
          {confirmState.previewResult ? (
            <div className="duplicates-preview-details">
              <div className="duplicates-preview-detail"><span>{t("duplicates.previewAffectedGroups")}</span><strong>{confirmState.previewResult.groupCount || 0}</strong></div>
              <div className="duplicates-preview-detail"><span>{t("duplicates.previewAffectedFiles")}</span><strong>{confirmState.previewResult.fileCount || 0}</strong></div>
              <div className="duplicates-preview-detail"><span>{t("duplicates.previewReclaimedSpace")}</span><strong>{formatBytes(confirmState.previewResult.reclaimedBytes || 0)}</strong></div>
              {confirmState.previewResult.unchangedMessage ? (
                <div className="duplicates-preview-detail"><span>{t("duplicates.previewSummary")}</span><strong>{confirmState.previewResult.unchangedMessage}</strong></div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button type="button" className="duplicates-chip" onClick={onClose}>
            {locale === "en" ? "Cancel" : "取消"}
          </button>
          <button type="button" className="duplicates-chip" onClick={onPreview}>
            {t("actions.preview")}
          </button>
          <button type="button" className="action-button action-button-primary" onClick={onConfirm}>
            {locale === "en" ? "Confirm" : "确认执行"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DuplicateActionConfirmDialog);
