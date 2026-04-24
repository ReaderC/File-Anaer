import { memo } from "react";
import FilterField from "../FilterField";
import Icon from "../Icon.jsx";

function DuplicateToolbarSection({
  activeRoot,
  compareDirectoryPath,
  fileComparePath,
  form,
  hasScanResults,
  hasToolbarSearch,
  showSearchClose,
  locale,
  onChangeSearchQuery,
  onChangeUnit,
  onCloseSearch,
  onOpenPicker,
  onOpenSearch,
  onSetForm,
  pathLabel,
  primaryDirectoryPath,
  resolveDisplayPath,
  scanMode,
  searchQuery,
  t,
  unit,
  unitOptions,
  duplicateScanModes,
  duplicateModeLabel
}) {
  return (
    <section className="duplicates-toolbar-strip">
      {hasToolbarSearch ? (
        <div className="duplicates-toolbar-search-shell">
          <div className="duplicates-search is-expanded">
            <Icon name="search" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => onChangeSearchQuery(event.target.value)}
              placeholder={t("duplicates.searchPlaceholder")}
            />
          </div>
          {!showSearchClose ? null : (
            <button
              type="button"
              className="duplicates-toolbar-search-close"
              onClick={onCloseSearch}
            >
              <Icon name="close" />
              <span>{locale === "en" ? "Close" : "关闭"}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="duplicates-control-grid">
            <FilterField label={locale === "en" ? "Mode" : "模式"} icon="difference">
              <div className="duplicates-chip-row duplicates-mode-row">
                {duplicateScanModes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`duplicates-chip ${scanMode === value ? "is-active" : ""}`}
                    onClick={() => onSetForm((current) => ({
                      ...current,
                      mode: value,
                      path: value === "file"
                        ? (current.mode === "file" ? current.path : "")
                        : activeRoot,
                      comparePath: value === "scan" ? "" : (current.comparePath || activeRoot)
                    }))}
                  >
                    {duplicateModeLabel(value, locale)}
                  </button>
                ))}
              </div>
            </FilterField>
            {scanMode === "scan" ? (
              <FilterField label={locale === "en" ? "Scan Folder" : "扫描目录"} icon="folder_copy" className="duplicates-picker-field">
                <button type="button" className="file-picker-trigger" onClick={() => onOpenPicker("primary")}>
                  <span className="file-picker-trigger-copy" title={resolveDisplayPath(primaryDirectoryPath)}>
                    {pathLabel(resolveDisplayPath(primaryDirectoryPath)) || resolveDisplayPath(primaryDirectoryPath)}
                  </span>
                </button>
              </FilterField>
            ) : null}
            {scanMode === "folders" ? (
              <>
                <FilterField label={locale === "en" ? "Compare Folder 1" : "对比目录1"} icon="folder_copy" className="duplicates-picker-field">
                  <button type="button" className="file-picker-trigger" onClick={() => onOpenPicker("primary")}>
                    <span className="file-picker-trigger-copy" title={resolveDisplayPath(primaryDirectoryPath)}>
                      {pathLabel(resolveDisplayPath(primaryDirectoryPath)) || resolveDisplayPath(primaryDirectoryPath)}
                    </span>
                  </button>
                </FilterField>
                <FilterField label={locale === "en" ? "Compare Folder 2" : "对比目录2"} icon="folder_copy" className="duplicates-picker-field">
                  <button type="button" className="file-picker-trigger" onClick={() => onOpenPicker("compare")}>
                    <span className="file-picker-trigger-copy" title={resolveDisplayPath(compareDirectoryPath)}>
                      {pathLabel(resolveDisplayPath(compareDirectoryPath)) || resolveDisplayPath(compareDirectoryPath)}
                    </span>
                  </button>
                </FilterField>
              </>
            ) : null}
            {scanMode === "file" ? (
              <>
                <FilterField label={locale === "en" ? "Compare File" : "对比文件"} icon="description" className="duplicates-picker-field">
                  <button type="button" className="file-picker-trigger" onClick={() => onOpenPicker("file")}>
                    <span className="file-picker-trigger-copy" title={resolveDisplayPath(fileComparePath || activeRoot)}>
                      {pathLabel(resolveDisplayPath(fileComparePath)) || (locale === "en" ? "Select a file" : "选择文件")}
                    </span>
                  </button>
                </FilterField>
                <FilterField label={locale === "en" ? "Compare Folder" : "对比目录"} icon="folder_copy" className="duplicates-picker-field">
                  <button type="button" className="file-picker-trigger" onClick={() => onOpenPicker("compare")}>
                    <span className="file-picker-trigger-copy" title={resolveDisplayPath(compareDirectoryPath)}>
                      {pathLabel(resolveDisplayPath(compareDirectoryPath)) || resolveDisplayPath(compareDirectoryPath)}
                    </span>
                  </button>
                </FilterField>
              </>
            ) : null}
            <FilterField label={locale === "en" ? "Min Size" : "最小大小"} icon="straighten" className="duplicates-min-size-field">
              <div className="size-input-row">
                <input inputMode="decimal" placeholder="0" value={form.minSizeBytes} onChange={(event) => onSetForm((current) => ({ ...current, minSizeBytes: event.target.value.replace(/[^\d.]/g, "") }))} />
                <div className="duplicates-chip-row duplicates-unit-row">
                  {unitOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`duplicates-chip ${unit === value ? "is-active" : ""}`}
                      onClick={() => onChangeUnit(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </FilterField>
          </div>
          {hasScanResults ? (
            <button
              type="button"
              className="duplicates-toolbar-search-toggle"
              onClick={onOpenSearch}
            >
              <Icon name="search" />
              <span>{locale === "en" ? "Search" : "搜索"}</span>
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

export default memo(DuplicateToolbarSection);
