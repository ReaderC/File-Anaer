import { memo } from "react";
import EmptyState from "../EmptyState";
import Icon from "../Icon.jsx";
import LoadingState from "../LoadingState";

function DuplicatePageFeedback({
  formatDuplicateProgressTitle,
  hasScanResults,
  job,
  locale,
  onDismissError,
  pageError,
  restoringHistoryId,
  rootsLoading,
  showDismissiblePageError,
  showIdleEmptyState,
  t
}) {
  return (
    <>
      {rootsLoading && !hasScanResults ? <LoadingState title={t("messages.loadingData")} /> : null}
      {showDismissiblePageError ? (
        <section className="duplicates-error-banner" role="alert" aria-live="polite">
          <div className="duplicates-error-banner-copy">
            <Icon name="warning" />
            <span className="duplicates-error-banner-message">{pageError}</span>
          </div>
          <button
            type="button"
            className="duplicates-error-banner-close"
            onClick={onDismissError}
            aria-label={locale === "en" ? "Dismiss error" : "关闭错误提示"}
          >
            <Icon name="close" />
          </button>
        </section>
      ) : null}
      {job?.status === "running" && !hasScanResults ? <LoadingState title={formatDuplicateProgressTitle(job, t, locale)} description={t("duplicates.loadingHint")} /> : null}
      {restoringHistoryId && !hasScanResults ? <LoadingState title={locale === "en" ? "Loading history..." : "正在加载历史..."} description={locale === "en" ? "Restoring duplicate groups from disk." : "正在从磁盘恢复重复文件结果。"} /> : null}
      {!hasScanResults && showIdleEmptyState ? <EmptyState title={t("duplicates.emptyTitle")} description={t("duplicates.emptyDesc")} /> : null}
    </>
  );
}

export default memo(DuplicatePageFeedback);
