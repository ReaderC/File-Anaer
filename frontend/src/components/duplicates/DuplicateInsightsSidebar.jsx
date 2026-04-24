import { memo } from "react";
import DuplicateIgnoredGroupsCard from "./DuplicateIgnoredGroupsCard";
import DuplicatePreviewCard from "./DuplicatePreviewCard";
import DuplicateTypeInsightsCard from "./DuplicateTypeInsightsCard";

function DuplicateInsightsSidebar({
  formatBytes,
  formatDateTime,
  handleClearIgnoredGroupsInView,
  handleCopy,
  handleRemoveIgnoredGroup,
  hasCompletedResults,
  ignoredGroupEntriesForView,
  ignoredGroupsExpanded,
  insightStats,
  locale,
  mediaPreviewMessage,
  mediaPreviewSupported,
  onExpandPreview,
  previewError,
  previewKind,
  previewLoading,
  previewURL,
  progressTone,
  resolveDisplayPath,
  selectedFile,
  setIgnoredGroupsExpanded,
  setShowInsights,
  setShowPreviewDetails,
  showInsights,
  showPreviewDetails,
  t,
  textPreview
}) {
  return (
    <aside className="duplicates-insights">
      <DuplicatePreviewCard
        formatBytes={formatBytes}
        formatDateTime={formatDateTime}
        hasCompletedResults={hasCompletedResults}
        locale={locale}
        mediaPreviewMessage={mediaPreviewMessage}
        mediaPreviewSupported={mediaPreviewSupported}
        onCopyPath={handleCopy}
        onExpandPreview={onExpandPreview}
        onToggleDetails={() => setShowPreviewDetails((current) => !current)}
        previewError={previewError}
        previewKind={previewKind}
        previewLoading={previewLoading}
        previewURL={previewURL}
        resolveDisplayPath={resolveDisplayPath}
        selectedFile={selectedFile}
        showPreviewDetails={showPreviewDetails}
        t={t}
        textPreview={textPreview}
      />

      <DuplicateTypeInsightsCard
        formatBytes={formatBytes}
        insightStats={insightStats}
        locale={locale}
        onToggle={() => setShowInsights((current) => !current)}
        progressTone={progressTone}
        showInsights={showInsights}
      />

      <DuplicateIgnoredGroupsCard
        entries={ignoredGroupEntriesForView}
        expanded={ignoredGroupsExpanded}
        locale={locale}
        onClear={handleClearIgnoredGroupsInView}
        onRemove={handleRemoveIgnoredGroup}
        onToggle={() => setIgnoredGroupsExpanded((current) => !current)}
      />
    </aside>
  );
}

export default memo(DuplicateInsightsSidebar);
