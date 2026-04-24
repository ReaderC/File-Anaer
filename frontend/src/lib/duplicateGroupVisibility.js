const DUPLICATE_IGNORED_GROUPS_KEY = "file-anaer.duplicateIgnoredGroups";

export function readDuplicateIgnoredGroups() {
  try {
    const raw = localStorage.getItem(DUPLICATE_IGNORED_GROUPS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.key) : [];
  } catch {
    return [];
  }
}

export function writeDuplicateIgnoredGroups(entries) {
  try {
    localStorage.setItem(DUPLICATE_IGNORED_GROUPS_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch {
    // ignore storage errors
  }
}

export function buildDuplicateGroupDecisionKey({ root, mode, path, comparePath, hash }) {
  return [root, mode, normalizePath(path), normalizePath(comparePath), hash].join("|");
}

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}
