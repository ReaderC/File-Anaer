import { getFileMeta } from "./fileMeta";

export function duplicateScopeFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "sameFolder") return "Same Folder";
    if (key === "sameParentSubdirs") return "Sibling Folders";
    return "All";
  }
  if (key === "sameFolder") return "同目录";
  if (key === "sameParentSubdirs") return "同级目录";
  return "全部";
}

export function duplicateTimeFeatureFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "recent") return "Recent";
    if (key === "idle") return "Idle";
    return "All";
  }
  if (key === "recent") return "近期修改";
  if (key === "idle") return "长期未改";
  return "全部";
}

export function duplicateNamingFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "sameName") return "Same Name";
    if (key === "differentName") return "Different Name";
    return "All";
  }
  if (key === "sameName") return "仅同名";
  if (key === "differentName") return "仅不同名";
  return "全部";
}

export function duplicateGroupSizeFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "3plus") return "3+ Files";
    if (key === "5plus") return "5+ Files";
    return "All";
  }
  if (key === "3plus") return "3个及以上";
  if (key === "5plus") return "5个及以上";
  return "全部";
}

export function duplicateExtensionFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "sameExtension") return "Same Ext";
    if (key === "crossExtension") return "Cross Ext";
    return "All";
  }
  if (key === "sameExtension") return "同扩展";
  if (key === "crossExtension") return "跨扩展";
  return "全部";
}

export function duplicatePathFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "similar") return "Similar";
    if (key === "different") return "Different";
    return "All";
  }
  if (key === "similar") return "路径相似";
  if (key === "different") return "路径不相似";
  return "全部";
}

export function duplicateBenefitFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "100mb") return "Waste >= 100 MB";
    if (key === "1gb") return "Waste >= 1 GB";
    return "All";
  }
  if (key === "100mb") return "浪费 >= 100MB";
  if (key === "1gb") return "浪费 >= 1GB";
  return "全部";
}

export function duplicateSelectedStatusFilterLabel(key, locale) {
  if (locale === "en") {
    if (key === "selected") return "Selected";
    if (key === "unselected") return "Unselected";
    return "All";
  }
  if (key === "selected") return "仅已勾选组";
  if (key === "unselected") return "仅未勾选组";
  return "全部";
}

export function duplicateActionModeLabel(mode, locale) {
  if (locale === "en") {
    if (mode === "delete") return "Delete";
    if (mode === "rename") return "Rename";
    if (mode === "hardlink") return "Hardlink";
    if (mode === "symlink") return "Symlink";
    if (mode === "reflink") return "Reflink";
    return "Action";
  }
  if (mode === "delete") return "删除副本";
  if (mode === "rename") return "重命名";
  if (mode === "hardlink") return "硬链接";
  if (mode === "symlink") return "软链接";
  if (mode === "reflink") return "Reflink";
  return "操作";
}

export function duplicateModeLabel(mode, locale) {
  if (locale === "en") {
    if (mode === "folders") return "Folder vs Folder";
    if (mode === "file") return "File vs Folder";
    return "Scan Folder";
  }
  if (mode === "folders") return "目录对目录";
  if (mode === "file") return "文件对目录";
  return "扫描目录";
}

export function formatDuplicateProgressTitle(job, t, locale) {
  if (!job?.progressText) {
    return t("duplicates.loading");
  }
  const stepLabel = job.progressStep > 0 && job.progressTotal > 0
    ? (locale === "en" ? `Phase ${job.progressStep}/${job.progressTotal}` : `第 ${job.progressStep} / ${job.progressTotal} 阶段`)
    : "";
  const phaseLabel = formatDuplicatePhaseText(job.progressText, locale);
  if (stepLabel && phaseLabel) {
    return `${t("duplicates.loading")} · ${stepLabel} · ${phaseLabel}`;
  }
  return `${t("duplicates.loading")} · ${phaseLabel || job.progressText}`;
}

export function formatDuplicatePhaseText(progressText, locale) {
  const text = String(progressText || "").trim();
  if (!text) {
    return "";
  }
  const regexLabels = [
    {
      pattern: /^Scanning files(.*)$/i,
      render: (match) => locale === "en" ? `Scanning files${match[1]}` : `扫描文件${match[1]}`
    },
    {
      pattern: /^Found (.+) candidates after grouping by paths$/i,
      render: (match) => locale === "en" ? match[0] : `按路径分组后找到 ${match[1]} 个候选文件`
    }
  ];
  const phaseLabels = [
    ["Walking", locale === "en" ? "Walking files" : "遍历文件"],
    ["Grouping by size", locale === "en" ? "Grouping by size" : "按大小分组"],
    ["Fetching extents", locale === "en" ? "Fetching file identifiers" : "读取文件标识"],
    ["Transforming and grouping", locale === "en" ? "Transforming and grouping" : "转换并分组"],
    ["Grouping by prefix hash", locale === "en" ? "Grouping by prefix hash" : "按前缀哈希分组"],
    ["Grouping by prefix", locale === "en" ? "Grouping by prefix hash" : "按前缀哈希分组"],
    ["Grouping by suffix hash", locale === "en" ? "Grouping by suffix hash" : "按后缀哈希分组"],
    ["Grouping by suffix", locale === "en" ? "Grouping by suffix hash" : "按后缀哈希分组"],
    ["Grouping by full contents", locale === "en" ? "Grouping by full contents" : "按完整内容分组"],
    ["Grouping by contents", locale === "en" ? "Grouping by full contents" : "按完整内容分组"]
  ];

  for (const item of regexLabels) {
    const matched = text.match(item.pattern);
    if (matched) {
      return item.render(matched);
    }
  }

  for (const [prefix, label] of phaseLabels) {
    if (text.startsWith(prefix)) {
      return `${label}${text.slice(prefix.length)}`;
    }
  }
  return text;
}

export function formatDuplicateRefreshMessage({ missingCount, mergedCount, removedGroupCount, locale = "zh-CN" }) {
  if (locale === "en") {
    if (missingCount > 0 && mergedCount > 0) {
      return `${missingCount} missing files and ${mergedCount} already-merged files were removed across ${removedGroupCount} groups.`;
    }
    if (missingCount > 0) {
      return `${missingCount} missing files were removed across ${removedGroupCount} groups.`;
    }
    return `${mergedCount} already-merged files were folded out across ${removedGroupCount} groups.`;
  }
  if (missingCount > 0 && mergedCount > 0) {
    return `已移除 ${missingCount} 个缺失文件，并折叠 ${mergedCount} 个已同源合并文件，共 ${removedGroupCount} 组。`;
  }
  if (missingCount > 0) {
    return `已移除 ${missingCount} 个缺失文件，共 ${removedGroupCount} 组。`;
  }
  return `已折叠 ${mergedCount} 个已同源合并文件，共 ${removedGroupCount} 组。`;
}

export function summarizeByType(groups) {
  const totals = new Map();
  let total = 0;
  for (const group of groups) {
    const key = getFileMeta(group.files[0]?.name ?? "", "", false).label.toLowerCase();
    const label = ({ video: "视频", image: "图片", document: "文档", archive: "压缩包" }[key]) || "其他";
    totals.set(key, { key, label, sizeBytes: (totals.get(key)?.sizeBytes || 0) + group.wastedBytes });
    total += group.wastedBytes;
  }
  return [...totals.values()].sort((a, b) => b.sizeBytes - a.sizeBytes).map((item) => ({ ...item, percentage: total > 0 ? item.sizeBytes / total * 100 : 0 }));
}

export function duplicateFileTime(file) {
  const value = new Date(file?.modifiedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function groupSortTime(group) {
  return Math.max(...(group.files || []).map((file) => duplicateFileTime(file)), 0);
}

export function compareGroups(left, right, sortOrder) {
  if (sortOrder === "timeAsc") {
    return groupSortTime(left) - groupSortTime(right);
  }
  if (sortOrder === "sizeAsc") {
    return left.sizeBytes - right.sizeBytes || groupSortTime(right) - groupSortTime(left);
  }
  if (sortOrder === "sizeDesc") {
    return right.sizeBytes - left.sizeBytes || groupSortTime(right) - groupSortTime(left);
  }
  return groupSortTime(right) - groupSortTime(left);
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function progressTone(key) {
  return ({ video: "progress-video", image: "progress-image", document: "progress-document", archive: "progress-archive" }[key]) || "progress-other";
}
