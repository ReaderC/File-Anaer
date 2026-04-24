import { memo } from "react";
import DuplicateActionConfirmDialog from "./DuplicateActionConfirmDialog";
import DuplicateActionLogDialog from "./DuplicateActionLogDialog";
import FilePickerDialog from "../FilePickerDialog";

function DuplicateDialogs({
  actionLogFilter,
  actionLogs,
  actionLogsOpen,
  confirmMessage,
  confirmState,
  directories,
  filteredActionLogs,
  handlePickerConfirm,
  hasFullSelection,
  locale,
  onChangeActionLogFilter,
  onChangeConfirmState,
  onCloseActionLogs,
  onCloseConfirm,
  onClosePicker,
  onConfirmAction,
  onDeleteActionLog,
  onPickerBrowsePathChange,
  onPickerRootChange,
  onPreviewAction,
  onUndoActionLog,
  onClearActionLogs,
  openPicker,
  pickerBrowsePath,
  pickerIgnoreList,
  pickerMode,
  pickerRoot,
  pickerSelectedPath,
  pickerTitle,
  roots,
  searchPlaceholder,
  selectedFileCount,
  selectionSummary,
  t,
  title,
  undoLoading
}) {
  return (
    <>
      <DuplicateActionConfirmDialog
        confirmState={confirmState}
        hasFullSelection={hasFullSelection}
        locale={locale}
        onChange={onChangeConfirmState}
        onClose={onCloseConfirm}
        onConfirm={onConfirmAction}
        onPreview={onPreviewAction}
        selectedFileCount={selectedFileCount}
        selectionSummary={selectionSummary}
        t={t}
        title={title}
        confirmMessage={confirmMessage}
      />
      <DuplicateActionLogDialog
        open={actionLogsOpen}
        locale={locale}
        actionLogs={actionLogs}
        filteredActionLogs={filteredActionLogs}
        actionLogFilter={actionLogFilter}
        undoLoading={undoLoading}
        onClose={onCloseActionLogs}
        onFilterChange={onChangeActionLogFilter}
        onUndo={onUndoActionLog}
        onDelete={onDeleteActionLog}
        onClear={onClearActionLogs}
      />
      <FilePickerDialog
        open={openPicker}
        mode={pickerMode}
        roots={roots}
        root={pickerRoot}
        browsePath={pickerBrowsePath}
        selectedPath={pickerSelectedPath}
        ignoreList={pickerIgnoreList}
        title={pickerTitle}
        searchPlaceholder={searchPlaceholder}
        directories={directories}
        onClose={onClosePicker}
        onConfirm={handlePickerConfirm}
        onRootChange={onPickerRootChange}
        onBrowsePathChange={onPickerBrowsePathChange}
      />
    </>
  );
}

export default memo(DuplicateDialogs);
