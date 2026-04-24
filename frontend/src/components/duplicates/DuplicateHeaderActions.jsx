import { memo } from "react";
import ActionButton from "../ActionButton";
import HistoryPanel from "../HistoryPanel";
import { formatBytes, formatHistoryTime } from "../../lib/format";
import { pathLabel } from "../../lib/pathUtils";

function DuplicateHeaderActions({
  canStart,
  error,
  exporting,
  groupsLength,
  handleClearResults,
  handleExportDuplicates,
  handleHistoryClear,
  handleHistoryDelete,
  handleHistoryRescan,
  handleRefreshFileStates,
  handleRescanCurrent,
  handleStart,
  historyEntries,
  historyLoading,
  historyLimit,
  historyOpen,
  historyRef,
  job,
  locale,
  onOpenActionLogs,
  restoringHistoryId,
  restoreHistoryEntry,
  setHistoryOpen,
  showFindButton,
  showHistoryMenu,
  showRefreshListState,
  t
}) {
  return (
    <section className="duplicates-actions-row">
      <div className="duplicates-heading">
        <h3 className="duplicates-page-title">{t("duplicates.resultsTitle")}</h3>
      </div>
      <div className="page-header-actions">
        <ActionButton tone="secondary" icon="download" onClick={handleExportDuplicates} disabled={exporting || !groupsLength}>
          {locale === "en" ? "Export CSV" : t("actions.exportDuplicateResults")}
        </ActionButton>
        <ActionButton tone="secondary" icon="receipt_long" onClick={onOpenActionLogs}>
          {locale === "en" ? "Action Log" : "操作日志"}
        </ActionButton>
        {showHistoryMenu ? (
          <div className="history-menu" ref={historyRef}>
            <ActionButton tone="secondary" icon="history" onClick={() => setHistoryOpen((current) => !current)}>
              {t("actions.history")}
            </ActionButton>
            {historyOpen ? (
              <HistoryPanel
                title={t("messages.historyTitle")}
                count={historyEntries.length}
                limit={historyLimit}
                clearLabel={t("actions.clearHistory")}
                emptyLabel={t("messages.noHistory")}
                isLoading={historyLoading}
                loadingLabel={locale === "en" ? "Loading history..." : "正在加载历史..."}
                entries={historyEntries}
                onClear={handleHistoryClear}
                renderEntry={(entry) => (
                  <div key={entry.id} className="history-item">
                    <button type="button" className="history-item-main" onClick={() => restoreHistoryEntry(entry)}>
                      <span className="history-item-title" title={entry.path}>{pathLabel(entry.path || entry.result?.path || entry.root)}</span>
                      <span className="history-item-meta history-item-meta-block">
                        {restoringHistoryId === entry.id ? (
                          <span>{locale === "en" ? "Loading history..." : "正在加载历史..."}</span>
                        ) : (
                          <>
                            <span>{formatBytes(entry.totalWastedBytes || 0)}</span>
                            <span>{locale === "en" ? `${entry.totalGroups || 0} groups` : `${entry.totalGroups || 0} 组`}</span>
                            <span>{formatHistoryTime(entry.savedAt)}</span>
                          </>
                        )}
                      </span>
                    </button>
                    <div className="history-item-buttons">
                      <button type="button" className="history-delete-button" onClick={() => handleHistoryRescan(entry)}>{t("actions.rescan")}</button>
                      <button type="button" className="history-delete-button" onClick={() => handleHistoryDelete(entry.id)}>{t("actions.delete")}</button>
                    </div>
                  </div>
                )}
              />
            ) : null}
          </div>
        ) : null}
        <ActionButton tone="secondary" icon={job?.status === "running" ? "stop_circle" : "ink_eraser"} onClick={handleClearResults} disabled={job?.status !== "running" && !job && !error}>
          {job?.status === "running" ? t("actions.stop") : t("actions.clear")}
        </ActionButton>
        <ActionButton tone="secondary" icon="refresh" onClick={handleRescanCurrent} disabled={job?.status === "running" || !job?.result?.path}>
          {t("actions.rescan")}
        </ActionButton>
        {showRefreshListState ? (
          <ActionButton tone="secondary" icon="playlist_remove" onClick={handleRefreshFileStates} disabled={job?.status === "running" || !groupsLength}>
            {locale === "en" ? "Refresh State" : "刷新列表状态"}
          </ActionButton>
        ) : null}
        {showFindButton ? (
          <ActionButton tone="primary" icon="content_copy" onClick={handleStart} disabled={job?.status === "running" || !canStart}>
            {locale === "en" ? "Find Duplicates" : t("duplicates.findDuplicates")}
          </ActionButton>
        ) : null}
      </div>
    </section>
  );
}

export default memo(DuplicateHeaderActions);
