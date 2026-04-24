import { memo } from "react";

function HistoryPanel({
  title,
  count,
  limit,
  clearLabel,
  emptyLabel,
  isLoading = false,
  loadingLabel = "",
  entries,
  onClear,
  renderEntry
}) {
  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <strong>{title}</strong>
        <div className="history-panel-actions">
          <span>{count} / {limit}</span>
          <button type="button" className="history-clear-button" onClick={onClear}>
            {clearLabel}
          </button>
        </div>
      </div>
      <div className="history-panel-body">
        {isLoading
          ? <div className="history-empty">{loadingLabel || emptyLabel}</div>
          : entries.length
            ? entries.map(renderEntry)
            : <div className="history-empty">{emptyLabel}</div>}
      </div>
    </div>
  );
}

export default memo(HistoryPanel);
