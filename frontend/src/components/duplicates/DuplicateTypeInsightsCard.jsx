import { memo } from "react";

function DuplicateTypeInsightsCard({
  formatBytes,
  insightStats,
  locale,
  onToggle,
  progressTone,
  showInsights
}) {
  return (
    <div className="card duplicates-insight-card">
      <div className="duplicates-insight-header">
        <h4>{locale === "en" ? "Duplicate Types" : "重复文件类型"}</h4>
        <button type="button" className="panel-toggle-button" onClick={onToggle}>
          {showInsights ? (locale === "en" ? "Hide" : "收起") : (locale === "en" ? "Show" : "展开")}
        </button>
      </div>
      {showInsights && insightStats.length ? (
        <div className="duplicates-insight-list">
          {insightStats.map((item) => (
            <div key={item.label} className="duplicates-insight-item">
              <div className="duplicates-insight-copy">
                <span>{item.label}</span>
                <strong>{formatBytes(item.sizeBytes)} ({item.percentage.toFixed(0)}%)</strong>
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${progressTone(item.key)}`} style={{ width: `${Math.max(item.percentage, 2)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="duplicates-preview-empty compact">
          {insightStats.length
            ? (locale === "en" ? "Duplicate file types are collapsed." : "重复文件类型已折叠。")
            : (locale === "en" ? "No duplicate file types yet." : "当前没有重复文件类型数据。")}
        </div>
      )}
    </div>
  );
}

export default memo(DuplicateTypeInsightsCard);
