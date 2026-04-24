import { fetchSettings as fetchSettingsRequest, updateSettings as updateSettingsRequest } from "../api/client";

const LOCALE_KEY = "file-anaer.locale";
const SCAN_IGNORE_KEY = "file-anaer.scanIgnore";
const SEARCH_IGNORE_KEY = "file-anaer.searchIgnore";
const DUPLICATE_IGNORE_KEY = "file-anaer.duplicateIgnore";
const SEARCH_HIDDEN_KEY = "file-anaer.searchHidden";
const SEARCH_PAGE_SIZE_KEY = "file-anaer.searchPageSize";
const TREEMAP_FILE_COLOR_MODE_KEY = "file-anaer.treemapFileColorMode";
const TREEMAP_DETAIL_LEVEL_KEY = "file-anaer.treemapDetailLevel";
const COPY_HOST_PATH_KEY = "file-anaer.copyHostPath";
const DUPLICATE_ALLOW_FULL_SELECTION_KEY = "file-anaer.duplicateAllowFullSelection";
const THEME_KEY = "file-anaer.theme";

export function readSettingsSnapshot() {
  return {
    locale: readLocaleSetting(),
    theme: readThemeSetting(),
    treemapFileColorMode: readTreemapFileColorModeSetting(),
    treemapDetailLevel: readTreemapDetailLevelSetting(),
    copyHostPath: readCopyHostPathSetting(),
    duplicateAllowFullSelection: readDuplicateAllowFullSelectionSetting(),
    scanIgnore: readScanIgnoreList(),
    duplicateIgnore: readDuplicateIgnoreList(),
    searchIgnore: readSearchIgnoreList(),
    searchHidden: readSearchHiddenSetting(),
    searchPageSize: readSearchPageSizeSetting()
  };
}

export function writeSettingsSnapshot(settings = {}) {
  writeLocaleSetting(settings.locale);
  writeThemeSetting(settings.theme);
  writeTreemapFileColorModeSetting(settings.treemapFileColorMode);
  writeTreemapDetailLevelSetting(settings.treemapDetailLevel);
  writeCopyHostPathSetting(settings.copyHostPath);
  writeDuplicateAllowFullSelectionSetting(settings.duplicateAllowFullSelection);
  writeScanIgnoreList(settings.scanIgnore);
  writeDuplicateIgnoreList(settings.duplicateIgnore);
  writeSearchIgnoreList(settings.searchIgnore);
  writeSearchHiddenSetting(settings.searchHidden);
  writeSearchPageSizeSetting(settings.searchPageSize);
  return readSettingsSnapshot();
}

export async function hydrateSettingsFromServer() {
  const payload = await fetchSettingsRequest();
  return writeSettingsSnapshot(payload);
}

export async function persistSettingsToServer() {
  const payload = readSettingsSnapshot();
  const saved = await updateSettingsRequest(payload);
  return writeSettingsSnapshot(saved);
}

export function readLocaleSetting() {
  return readEnumSetting(LOCALE_KEY, ["zh", "en"], "zh");
}

export function writeLocaleSetting(value) {
  writeEnumSetting(LOCALE_KEY, value, ["zh", "en"], "zh");
}

export function readScanIgnoreList() {
  return readList(SCAN_IGNORE_KEY);
}

export function writeScanIgnoreList(list) {
  writeList(SCAN_IGNORE_KEY, list);
}

export function readSearchIgnoreList() {
  return readList(SEARCH_IGNORE_KEY);
}

export function writeSearchIgnoreList(list) {
  writeList(SEARCH_IGNORE_KEY, list);
}

export function readDuplicateIgnoreList() {
  return readList(DUPLICATE_IGNORE_KEY);
}

export function writeDuplicateIgnoreList(list) {
  writeList(DUPLICATE_IGNORE_KEY, list);
}

export function readSearchHiddenSetting() {
  return readBooleanSetting(SEARCH_HIDDEN_KEY, false);
}

export function writeSearchHiddenSetting(value) {
  writeBooleanSetting(SEARCH_HIDDEN_KEY, value);
}

export function readSearchPageSizeSetting() {
  return readNumberSetting(SEARCH_PAGE_SIZE_KEY, 50, { min: 10, max: 500 });
}

export function writeSearchPageSizeSetting(value) {
  writeNumberSetting(SEARCH_PAGE_SIZE_KEY, value, 50, { min: 10, max: 500 });
}

export function readTreemapFileColorModeSetting() {
  return readEnumSetting(TREEMAP_FILE_COLOR_MODE_KEY, ["size", "type"], "size");
}

export function writeTreemapFileColorModeSetting(value) {
  writeEnumSetting(TREEMAP_FILE_COLOR_MODE_KEY, value, ["size", "type"], "size");
}

export function readTreemapDetailLevelSetting() {
  return readEnumSetting(TREEMAP_DETAIL_LEVEL_KEY, ["simple", "medium", "detailed"], "medium");
}

export function writeTreemapDetailLevelSetting(value) {
  writeEnumSetting(TREEMAP_DETAIL_LEVEL_KEY, value, ["simple", "medium", "detailed"], "medium");
}

export function readCopyHostPathSetting() {
  return readBooleanSetting(COPY_HOST_PATH_KEY, true);
}

export function writeCopyHostPathSetting(value) {
  writeBooleanSetting(COPY_HOST_PATH_KEY, value);
}

export function readDuplicateAllowFullSelectionSetting() {
  return readBooleanSetting(DUPLICATE_ALLOW_FULL_SELECTION_KEY, false);
}

export function writeDuplicateAllowFullSelectionSetting(value) {
  writeBooleanSetting(DUPLICATE_ALLOW_FULL_SELECTION_KEY, value);
}

export function readThemeSetting() {
  return readEnumSetting(THEME_KEY, ["system", "light", "dark"], "system");
}

export function writeThemeSetting(value) {
  writeEnumSetting(THEME_KEY, value, ["system", "light", "dark"], "system");
}

function readBooleanSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      return fallback;
    }
    return raw === "true";
  } catch {
    return fallback;
  }
}

function writeBooleanSetting(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch {
    // ignore storage errors
  }
}

function readEnumSetting(key, allowedValues, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowedValues.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeEnumSetting(key, value, allowedValues, fallback) {
  try {
    localStorage.setItem(key, allowedValues.includes(value) ? value : fallback);
  } catch {
    // ignore storage errors
  }
}

function readNumberSetting(key, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return clampNumber(parsed, min, max);
  } catch {
    return fallback;
  }
}

function writeNumberSetting(key, value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  try {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed) ? clampNumber(parsed, min, max) : fallback;
    localStorage.setItem(key, String(normalized));
  } catch {
    // ignore storage errors
  }
}

export function isIgnoredPath(candidatePath, ignoreList) {
  if (!candidatePath) {
    return false;
  }
  const normalizedCandidate = normalizePath(candidatePath);
  return ignoreList.some((item) => {
    const normalizedIgnore = normalizePath(item);
    if (!normalizedIgnore || normalizedIgnore.includes("*")) {
      return false;
    }
    return normalizedCandidate === normalizedIgnore || normalizedCandidate.startsWith(`${normalizedIgnore}/`);
  });
}

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list.filter(Boolean) : []));
  } catch {
    // ignore storage errors
  }
}

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
