import { memo } from "react";
import { formatHistoryTime } from "../../lib/format";

function DuplicateIgnoredGroupsCard({
  entries,
  expanded,
  locale,
  onClear,
  onRemove,
  onToggle
}) {
  return (
    <div className="card duplicates-insight-card">
      <div className="duplicates-insight-header">
        <h4>{locale === "en" ? "Ignored Groups" : "忽略分组"}</h4>
        <div className="duplicates-insight-actions">
          <button type="button" className="panel-toggle-button" onClick={onToggle}>
            {expanded ? (locale === "en" ? "Hide" : "收起") : (locale === "en" ? "Show" : "展开")}
          </button>
          <button
            type="button"
            className="panel-toggle-button"
            onClick={onClear}
            disabled={!entries.length}
          >
            {locale === "en" ? "Restore All" : "全部恢复"}
          </button>
        </div>
      </div>
      {expanded ? (
        entries.length ? (
          <div className="duplicates-action-log-list">
            {entries.map((entry) => (
              <div key={entry.key} className="duplicates-action-log-item">
                <div className="duplicates-action-log-copy">
                  <strong>{entry.name}</strong>
                  <span>{formatHistoryTime(entry.savedAt)}</span>
                </div>
                <div className="duplicates-action-log-actions">
                  <button type="button" className="panel-toggle-button" onClick={() => onRemove(entry.key)}>
                    {locale === "en" ? "Restore" : "恢复显示"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="duplicates-preview-empty compact">{locale === "en" ? "No ignored groups in the current scope." : "当前范围内没有被忽略的分组。"}</div>
      ) : (
        <div className="duplicates-action-log-list">
          <div className="duplicates-preview-empty compact">
            {entries.length
              ? (locale === "en" ? `Ignored groups are collapsed (${entries.length}).` : `忽略分组已折叠（${entries.length} 项）。`)
              : (locale === "en" ? "No ignored groups in the current scope." : "当前范围内没有被忽略的分组。")}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DuplicateIgnoredGroupsCard);
