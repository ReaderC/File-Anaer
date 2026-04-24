import { useEffect, useMemo, useState } from "react";
import { buildPreviewURL, fetchDirectories, fetchTextPreview } from "../api/client";
import ArchivePreviewList from "./ArchivePreviewList";
import Icon from "./Icon.jsx";
import TextPreviewContent from "./TextPreviewContent";

const EXPANDED_TEXT_LIMIT = 256 * 1024;
const EXPANDED_ENTRY_LIMIT = 2000;

export default function PreviewDialog({
  item,
  locale,
  mediaPreviewMessage,
  mediaPreviewSupported,
  onClose,
  open,
  previewKind,
  previewRoot
}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const previewURL = useMemo(
    () => (item && previewRoot ? buildPreviewURL(previewRoot, item.path) : ""),
    [item, previewRoot]
  );

  useEffect(() => {
    if (!open || !item || !previewRoot || (previewKind !== "text" && previewKind !== "folder")) {
      setPayload(null);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const request = previewKind === "folder"
      ? fetchDirectories(previewRoot, item.path, true).then((response) => ({
        kind: "archive-list",
        truncated: false,
        entries: (response?.items || [])
          .filter((entry) => entry?.name && entry.name !== "..")
          .map((entry) => ({
            name: entry.name,
            path: entry.path,
            parentPath: item.path,
            depth: 0,
            isDir: Boolean(entry.isDir),
            sizeBytes: undefined
          }))
      }))
      : fetchTextPreview(previewRoot, item.path, previewKind === "text" ? EXPANDED_TEXT_LIMIT : EXPANDED_ENTRY_LIMIT, true);

    request
      .then((response) => {
        if (!cancelled) {
          setPayload(response);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message);
          setPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item, open, previewKind, previewRoot]);

  if (!open || !item) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card dialog-card-preview" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="duplicates-log-dialog-header">
          <div className="dialog-copy">
            <h3>{locale === "en" ? "Expanded Preview" : "放大预览"}</h3>
            <p>{item.name}</p>
          </div>
          <button type="button" className="duplicates-log-dialog-close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="preview-dialog-body">
          <div className="preview-dialog-stage">
            {previewKind === "image" ? <img className="preview-dialog-image" src={previewURL} alt={item.name} /> : null}
            {previewKind === "video" ? (mediaPreviewSupported
              ? <video className="preview-dialog-video" controls preload="metadata" src={previewURL} />
              : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
            {previewKind === "audio" ? (mediaPreviewSupported
              ? <audio className="preview-dialog-audio" controls preload="metadata" src={previewURL} />
              : <div className="duplicates-preview-empty">{mediaPreviewMessage}</div>) : null}
            {previewKind === "pdf" ? <iframe className="preview-dialog-frame" src={previewURL} title={item.name} /> : null}
            {(previewKind === "text" || previewKind === "folder") ? (
              loading ? <div className="duplicates-preview-empty">{locale === "en" ? "Loading preview..." : "正在加载预览..."}</div>
              : error ? <div className="duplicates-preview-empty">{error}</div>
              : payload?.kind === "archive-list"
                ? <ArchivePreviewList entries={payload?.entries || []} locale={locale} detailed expanded />
                : payload?.kind === "unsupported"
                  ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div>
                  : <TextPreviewContent content={payload?.content || ""} fileName={item?.name || ""} expanded />
            ) : null}
            {previewKind === "unsupported" ? <div className="duplicates-preview-empty">{locale === "en" ? "Preview is not available for this format yet." : "当前格式暂不支持预览。"}</div> : null}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="panel-toggle-button" onClick={onClose}>
            {locale === "en" ? "Close" : "关闭"}
          </button>
        </div>
      </div>
    </div>
  );
}
