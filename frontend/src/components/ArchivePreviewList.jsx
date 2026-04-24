import Icon from "./Icon.jsx";
import { formatBytes } from "../lib/format";

export default function ArchivePreviewList({ entries = [], locale = "zh-CN", detailed = false, expanded = false }) {
  if (!entries.length) {
    return <div className="duplicates-preview-empty">{locale === "en" ? "Archive is empty." : "压缩包内容为空。"}</div>;
  }

  return (
    <div className={`archive-preview-list${expanded ? " is-expanded" : ""}`}>
      {entries.map((entry) => {
        const badge = entry.isDir ? (locale === "en" ? "FOLDER" : "文件夹") : archiveBadge(entry.name);
        const subtitle = detailed ? (entry.path || entry.parentPath || "/") : (entry.parentPath || "/");
        return (
          <div
            key={`${entry.path}-${entry.isDir ? "dir" : "file"}`}
            className={`archive-preview-item${entry.isDir ? " is-folder" : ""}${detailed ? " is-detailed" : ""}`}
            style={{ "--archive-depth": entry.depth || 0 }}
          >
            <div className="archive-preview-item-icon">
              <Icon name={entry.isDir ? "folder" : "description"} />
            </div>
            <div className="archive-preview-item-copy">
              <strong title={entry.name}>{entry.name}</strong>
              <span title={subtitle}>{subtitle}</span>
            </div>
            <div className="archive-preview-item-size">
              {entry.isDir ? "-" : Number.isFinite(entry.sizeBytes) && entry.sizeBytes > 0 ? formatBytes(entry.sizeBytes) : "-"}
            </div>
            <div className="archive-preview-item-badge" title={badge}>{badge}</div>
          </div>
        );
      })}
    </div>
  );
}

function archiveBadge(name) {
  const ext = (String(name || "").split(".").pop() || "").toUpperCase();
  return ext || "FILE";
}
