import { memo } from "react";
import Icon from "../Icon.jsx";
import { formatHistoryTime } from "../../lib/format";

const ACTION_LOG_FILTERS = ["all", "undoable", "rename", "other"];

function DuplicateActionLogDialog({
  actionLogFilter,
  actionLogs,
  filteredActionLogs,
  locale,
  onClear,
  onClose,
  onDelete,
  onFilterChange,
  onUndo,
  open,
  undoLoading
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card dialog-card-wide" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-copy">
          <div className="duplicates-log-dialog-header">
            <div>
              <h3>{locale === "en" ? "Action Logs" : "操作日志"}</h3>
              <p>{locale === "en" ? "Review recent duplicate actions and rollback availability." : "查看最近的重复文件操作记录，以及哪些操作支持回滚。"}</p>
            </div>
            <button type="button" className="duplicates-log-dialog-close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <div className="duplicates-log-filter-row">
            {ACTION_LOG_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className={`duplicates-chip ${actionLogFilter === key ? "is-active" : ""}`}
                onClick={() => onFilterChange(key)}
              >
                {actionLogFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-log-dialog-body">
          {filteredActionLogs.length ? (
            <div className="duplicates-action-log-list is-dialog">
              {filteredActionLogs.map((entry) => (
                <div key={entry.id} className="duplicates-action-log-item">
                  <div className="duplicates-action-log-copy">
                    <strong>{entry.title}</strong>
                    <span>{entry.summary}</span>
                    <span>{formatHistoryTime(entry.savedAt)}</span>
                  </div>
                  <div className="duplicates-action-log-actions">
                    {entry.rollback?.kind === "rename" && entry.rollbackStatus !== "undone" ? (
                      <button
                        type="button"
                        className="panel-toggle-button"
                        onClick={() => onUndo(entry)}
                        disabled={undoLoading === entry.id}
                      >
                        {undoLoading === entry.id
                          ? (locale === "en" ? "Undoing..." : "回滚中...")
                          : (locale === "en" ? "Undo Rename" : "回滚重命名")}
                      </button>
                    ) : null}
                    {entry.rollbackStatus === "undone" ? (
                      <span className="duplicates-action-log-state">{locale === "en" ? "Rolled Back" : "已回滚"}</span>
                    ) : null}
                    {entry.rollback?.kind !== "rename" ? (
                      <span className="duplicates-action-log-state">{locale === "en" ? "No Auto Undo" : "不支持自动回滚"}</span>
                    ) : null}
                    <button type="button" className="panel-toggle-button" onClick={() => onDelete(entry.id)}>
                      {locale === "en" ? "Remove" : "删除"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="duplicates-preview-empty compact">
              {actionLogs.length
                ? (locale === "en" ? "No logs match the current filter." : "当前筛选下没有匹配的操作日志。")
                : (locale === "en" ? "No action logs yet." : "当前还没有操作日志。")}
            </div>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="duplicates-chip" onClick={onClose}>
            {locale === "en" ? "Close" : "关闭"}
          </button>
          <button type="button" className="duplicates-chip" onClick={onClear} disabled={!actionLogs.length}>
            {locale === "en" ? "Clear Logs" : "清空日志"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DuplicateActionLogDialog);

function actionLogFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "undoable") return "Undoable";
    if (key === "rename") return "Rename";
    if (key === "other") return "Other Actions";
    return "All";
  }
  if (key === "undoable") return "仅可回滚";
  if (key === "rename") return "仅重命名";
  if (key === "other") return "仅非重命名";
  return "全部";
}
