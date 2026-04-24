import { memo } from "react";
import DuplicateBulkActionBar from "./DuplicateBulkActionBar";
import DuplicateFilterBar from "./DuplicateFilterBar";
import DuplicateResultsPanel from "./DuplicateResultsPanel";

function DuplicateResultsColumn(props) {
  const {
    filterBarRef,
    hasVisibleResults,
    actionLoading,
    activeRootWritable,
    applyComparedFolderSelection,
    applyQuickSelectionToVisibleGroups,
    duplicateActions,
    groups,
    ignoredGroupEntriesForView,
    locale,
    onClearSelectedPaths,
    onClearSkippedGroups,
    requestDuplicateAction,
    scanMode,
    selectedPaths,
    selectionSummary,
    skippedGroupKeys,
    t,
    bulkBarOffset,
    ...resultsProps
  } = props;

  return (
    <div className="duplicates-list">
      <DuplicateFilterBar
        {...resultsProps}
        barRef={filterBarRef}
        hasVisibleResults={hasVisibleResults}
        locale={locale}
        t={t}
      />
      {hasVisibleResults ? (
        <DuplicateBulkActionBar
          actionLoading={actionLoading}
          activeRootWritable={activeRootWritable}
          applyComparedFolderSelection={applyComparedFolderSelection}
          applyQuickSelectionToVisibleGroups={applyQuickSelectionToVisibleGroups}
          duplicateActions={duplicateActions}
          groups={groups}
          ignoredGroupEntriesForView={ignoredGroupEntriesForView}
          locale={locale}
          onClearSelectedPaths={onClearSelectedPaths}
          onClearSkippedGroups={onClearSkippedGroups}
          requestDuplicateAction={requestDuplicateAction}
          scanMode={scanMode}
          selectedPaths={selectedPaths}
          selectionSummary={selectionSummary}
          skippedGroupKeys={skippedGroupKeys}
          t={t}
          top={bulkBarOffset}
        />
      ) : null}
      <DuplicateResultsPanel
        {...resultsProps}
        groups={groups}
        hasVisibleResults={hasVisibleResults}
        locale={locale}
        t={t}
      />
    </div>
  );
}

export default memo(DuplicateResultsColumn);
