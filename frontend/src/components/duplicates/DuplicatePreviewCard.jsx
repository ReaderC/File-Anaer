import { memo } from "react";
import ArchivePreviewList from "../ArchivePreviewList";
import TextPreviewContent from "../TextPreviewContent";
import { getExtensionLabel, previewKindLabel } from "../../lib/previewFile";

function DuplicatePreviewCard({
  formatBytes,
  formatDateTime,
  hasCompletedResults,
  locale,
  mediaPreviewMessage,
  mediaPreviewSupported,
  onCopyPath,
  onExpandPreview,
  onToggleDetails,
  previewError,
  previewKind,
  previewLoading,
  previewURL,
  resolveDisplayPath,
  selectedFile,
  showPreviewDetails,
  t,
  textPreview
}) {
  return (
    <div className="card duplicates-preview-card">
      <div className="duplicates-preview-header">
        <div className="duplicates-preview-copy">
          <h4>{locale === "en" ? "Preview" : "预览"}</h4>
          <span>{selectedFile?.name || (locale === "en" ? "No file selected" : "未选择文件")}</span>
        </div>
        <div className="duplicates-preview-actions">
          {selectedFile ? <button type="button" className="panel-toggle-button" onClick={() => onCopyPath(selectedFile.path, selectedFile.hostPath)}>{t("actions.copyPath")}</button> : null}
        </div>
      </div>
      {selectedFile ? (
        <>
          <div className="duplicates-preview-stage">
            {previewKind === "image" ? <img className="duplicates-preview-image" src={previewURL} alt={selectedFile.name} /> : null}
            {previewKind === "video" ? (mediaPreviewSupported
              ? <video className="duplicates-preview-video" controls preload="metadata" src={previewURL} />
              : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
            {previewKind === "audio" ? (mediaPreviewSupported
              ? <audio className="duplicates-preview-audio" controls preload="metadata" src={previewURL} />
              : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
            {previewKind === "pdf" ? <iframe className="duplicates-preview-frame duplicates-preview-frame-pdf" src={previewURL} title={selectedFile.name} /> : null}
            {previewKind === "text" ? (
              previewLoading ? <div className="duplicates-preview-empty">{locale === "en" ? "Loading preview..." : "正在加载预览..."}</div>
              : previewError ? <div className="duplicates-preview-empty">{previewError}</div>
              : textPreview?.kind === "archive-list"
                ? <ArchivePreviewList entries={textPreview?.entries || []} locale={locale} />
                : textPreview?.kind === "unsupported"
                  ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div>
                : <TextPreviewContent content={textPreview?.content || ""} fileName={selectedFile?.name || ""} />
            ) : null}
            {previewKind === "unsupported" ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div> : null}
          </div>
          <div className="duplicates-preview-meta">
            <span className="duplicates-preview-size">{formatBytes(selectedFile.sizeBytes)}</span>
            <button type="button" className="panel-toggle-button" onClick={onExpandPreview}>{locale === "en" ? "Expand Preview" : "放大预览"}</button>
            <button type="button" className="panel-toggle-button" onClick={onToggleDetails}>
              {showPreviewDetails ? (locale === "en" ? "Hide Details" : "收起详情") : (locale === "en" ? "Show Details" : "展开详情")}
            </button>
            {previewKind === "text" && textPreview?.truncated ? <span>{textPreview?.kind === "archive-list" ? (locale === "en" ? "Showing the first 400 items" : "当前仅显示前 400 项") : (locale === "en" ? "Showing the first 64 KB" : "当前仅显示前 64 KB")}</span> : null}
          </div>
          {showPreviewDetails ? (
            <div className="duplicates-preview-details">
              <div className="duplicates-preview-detail"><span>{locale === "en" ? "Extension" : "扩展名"}</span><strong>{getExtensionLabel(selectedFile.name)}</strong></div>
              <div className="duplicates-preview-detail"><span>{locale === "en" ? "Preview Type" : "预览类型"}</span><strong>{previewKindLabel(previewKind, locale)}</strong></div>
              <div className="duplicates-preview-detail"><span>{locale === "en" ? "Modified" : "修改时间"}</span><strong>{formatDateTime(selectedFile.modifiedAt)}</strong></div>
              <div className="duplicates-preview-detail">
                <span>{locale === "en" ? "Location" : "所在目录"}</span>
                <strong className="duplicates-preview-path-value" title={resolveDisplayPath(selectedFile.parentPath)}>{resolveDisplayPath(selectedFile.parentPath) || "-"}</strong>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="duplicates-preview-empty">
          {hasCompletedResults ? (locale === "en" ? "Select a file to preview." : "选择一个文件进行预览。") : (locale === "en" ? "No duplicate files to preview." : "当前没有可预览的重复文件。")}
        </div>
      )}
    </div>
  );
}

export default memo(DuplicatePreviewCard);
