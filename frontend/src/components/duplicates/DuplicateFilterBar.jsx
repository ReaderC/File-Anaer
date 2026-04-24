import { memo } from "react";
import Icon from "../Icon.jsx";

function DuplicateFilterBar({
  barRef,
  benefitFilter,
  benefitFilters,
  duplicateBenefitFilterLabel,
  duplicateExtensionFilterLabel,
  duplicateGroupSizeFilterLabel,
  duplicateNamingFilterLabel,
  duplicatePathFilterLabel,
  duplicateScopeFilterLabel,
  duplicateSelectedStatusFilterLabel,
  duplicateTimeFeatureFilterLabel,
  extensionFilter,
  extensionFilters,
  filterBarExpanded,
  formatBytes,
  groupSizeFilter,
  groupSizeFilterOptions,
  hasCompletedResults,
  locale,
  namingFilter,
  namingFilters,
  onResetFilters,
  onSetBenefitFilter,
  onSetExtensionFilter,
  onSetFilterBarExpanded,
  onSetGroupSizeFilter,
  onSetNamingFilter,
  onSetPathFilter,
  onSetScopeFilter,
  onSetSelectedStatusFilter,
  onSetSizeFilter,
  onSetSortOrder,
  onSetTimeFeatureFilter,
  onSetTimeFilter,
  onSetTypeFilter,
  pathFilter,
  pathFilters,
  scopeFilter,
  scopeFilters,
  selectedStatusFilter,
  selectedStatusFilters,
  sizeFilter,
  sizeFilters,
  sortOptions,
  sortOrder,
  stats,
  t,
  timeFeatureFilter,
  timeFeatureFilters,
  timeFilter,
  timeFilters,
  typeFilter,
  typeFilters
}) {
  return (
    <section ref={barRef} className="duplicates-filter-bar is-floating">
      <div className="duplicates-filter-header">
        <div className="duplicates-filter-header-main">
          <span className="duplicates-filter-title">{locale === "en" ? "Filters" : "筛选"}</span>
          <div className="duplicates-filter-meta">
            {hasCompletedResults ? (
              <span>
                <span className="duplicates-filter-meta-highlight">{formatBytes(stats.totalWastedBytes)}</span>
                <span className="duplicates-summary-sep">·</span>
                <span>{t("duplicates.foundSummary", { groups: stats.totalGroups, files: stats.totalFiles })}</span>
              </span>
            ) : (
              <span>{t("duplicates.emptyTitle")}</span>
            )}
          </div>
        </div>
        <div className="duplicates-filter-header-actions">
          <button type="button" className="duplicates-filter-reset" onClick={onResetFilters}>
            <Icon name="restart_alt" />
            <span>{locale === "en" ? "Reset" : "重置"}</span>
          </button>
          <button type="button" className="duplicates-filter-toggle" onClick={() => onSetFilterBarExpanded((current) => !current)}>
            <Icon name={filterBarExpanded ? "expand_less" : "expand_more"} />
            <span>{filterBarExpanded ? (locale === "en" ? "Collapse" : "收起") : (locale === "en" ? "Expand" : "展开")}</span>
          </button>
        </div>
      </div>
      <div className={`duplicates-filter-body ${filterBarExpanded ? "is-expanded" : "is-collapsed"}`}>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{t("duplicates.filterType")}:</span>
          <div className="duplicates-chip-row">
            {typeFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${typeFilter === key ? "is-active" : ""}`} onClick={() => onSetTypeFilter(key)}>
                {t(`duplicates.type.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{t("duplicates.filterSize")}:</span>
          <div className="duplicates-chip-row">
            {sizeFilters.map((item) => (
              <button key={item.key} type="button" className={`duplicates-chip ${sizeFilter === item.key ? "is-active" : ""}`} onClick={() => onSetSizeFilter(item.key)}>
                {t(`duplicates.size.${item.key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Selection" : "勾选状态"}:</span>
          <div className="duplicates-chip-row">
            {selectedStatusFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${selectedStatusFilter === key ? "is-active" : ""}`} onClick={() => onSetSelectedStatusFilter(key)}>
                {duplicateSelectedStatusFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Waste" : "浪费空间"}:</span>
          <div className="duplicates-chip-row">
            {benefitFilters.map((item) => (
              <button key={item.key} type="button" className={`duplicates-chip ${benefitFilter === item.key ? "is-active" : ""}`} onClick={() => onSetBenefitFilter(item.key)}>
                {duplicateBenefitFilterLabel(item.key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{t("duplicates.filterTime")}:</span>
          <div className="duplicates-chip-row">
            {timeFilters.map((item) => (
              <button key={item.key} type="button" className={`duplicates-chip ${timeFilter === item.key ? "is-active" : ""}`} onClick={() => onSetTimeFilter(item.key)}>
                {t(`duplicates.time.${item.key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{t("duplicates.sortOrder")}:</span>
          <div className="duplicates-chip-row">
            {sortOptions.map((value) => (
              <button key={value} type="button" className={`duplicates-chip ${sortOrder === value ? "is-active" : ""}`} onClick={() => onSetSortOrder(value)}>
                {t(`duplicates.sort.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Scope" : "范围"}:</span>
          <div className="duplicates-chip-row">
            {scopeFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${scopeFilter === key ? "is-active" : ""}`} onClick={() => onSetScopeFilter(key)}>
                {duplicateScopeFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Time Trait" : "时间特征"}:</span>
          <div className="duplicates-chip-row">
            {timeFeatureFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${timeFeatureFilter === key ? "is-active" : ""}`} onClick={() => onSetTimeFeatureFilter(key)}>
                {duplicateTimeFeatureFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Naming" : "命名"}:</span>
          <div className="duplicates-chip-row">
            {namingFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${namingFilter === key ? "is-active" : ""}`} onClick={() => onSetNamingFilter(key)}>
                {duplicateNamingFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Ext" : "扩展名"}:</span>
          <div className="duplicates-chip-row">
            {extensionFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${extensionFilter === key ? "is-active" : ""}`} onClick={() => onSetExtensionFilter(key)}>
                {duplicateExtensionFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Path" : "路径"}:</span>
          <div className="duplicates-chip-row">
            {pathFilters.map((key) => (
              <button key={key} type="button" className={`duplicates-chip ${pathFilter === key ? "is-active" : ""}`} onClick={() => onSetPathFilter(key)}>
                {duplicatePathFilterLabel(key, locale)}
              </button>
            ))}
          </div>
        </div>
        <div className="duplicates-filter-group">
          <span className="duplicates-filter-label">{locale === "en" ? "Group Size" : "组大小"}:</span>
          <div className="duplicates-chip-row">
            {groupSizeFilterOptions.map((item) => (
              <button key={item.key} type="button" className={`duplicates-chip ${groupSizeFilter === item.key ? "is-active" : ""}`} onClick={() => onSetGroupSizeFilter(item.key)}>
                {duplicateGroupSizeFilterLabel(item.key, locale)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(DuplicateFilterBar);
