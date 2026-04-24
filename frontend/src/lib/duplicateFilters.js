import { parentPath } from "./pathUtils";
import { duplicateFileTime, groupSortTime } from "./duplicatePresentation";

export function filterDuplicateGroupByScope(group, scopeFilter) {
  if (!group || !Array.isArray(group.files)) {
    return null;
  }
  if (scopeFilter === "all") {
    return group;
  }
  if (scopeFilter === "sameParentSubdirs") {
    const siblingParentGroups = new Map();
    for (const file of group.files) {
      const parent = normalizeComparePath(file?.parentPath);
      const grandParent = normalizeComparePath(parentPath(parent, "/"));
      if (!parent || !grandParent || parent === grandParent) {
        continue;
      }
      const entry = siblingParentGroups.get(grandParent) || new Map();
      entry.set(parent, (entry.get(parent) || 0) + 1);
      siblingParentGroups.set(grandParent, entry);
    }
    const matchedParents = new Set();
    for (const [, parentMap] of siblingParentGroups) {
      if (parentMap.size < 2) {
        continue;
      }
      for (const parent of parentMap.keys()) {
        matchedParents.add(parent);
      }
    }
    const files = group.files.filter((file) => matchedParents.has(normalizeComparePath(file?.parentPath)));
    if (files.length < 2) {
      return null;
    }
    return {
      ...group,
      files,
      fileCount: files.length,
      wastedBytes: Math.max(files.length - 1, 0) * (group.sizeBytes || 0)
    };
  }
  if (scopeFilter !== "sameFolder") {
    return group;
  }
  const parentCounts = new Map();
  for (const file of group.files) {
    const key = normalizeComparePath(file?.parentPath);
    if (!key) {
      continue;
    }
    parentCounts.set(key, (parentCounts.get(key) || 0) + 1);
  }
  const files = group.files.filter((file) => {
    const key = normalizeComparePath(file?.parentPath);
    return key && (parentCounts.get(key) || 0) >= 2;
  });
  if (files.length < 2) {
    return null;
  }
  return {
    ...group,
    files,
    fileCount: files.length,
    wastedBytes: Math.max(files.length - 1, 0) * (group.sizeBytes || 0)
  };
}

export function matchesDuplicateNamingFilter(group, namingFilter) {
  if (!group || namingFilter === "all") {
    return true;
  }
  const nameSet = new Set(
    (group.files || [])
      .map((file) => String(file?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!nameSet.size) {
    return false;
  }
  if (namingFilter === "sameName") {
    return nameSet.size === 1;
  }
  if (namingFilter === "differentName") {
    return nameSet.size > 1;
  }
  return true;
}

export function matchesDuplicateTimeFeatureFilter(group, timeFeatureFilter, now = Date.now()) {
  if (!group || timeFeatureFilter === "all") {
    return true;
  }
  const newestTime = groupSortTime(group);
  if (!Number.isFinite(newestTime) || newestTime <= 0) {
    return false;
  }
  const ageMs = now - newestTime;
  if (timeFeatureFilter === "recent") {
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  }
  if (timeFeatureFilter === "idle") {
    return ageMs >= 90 * 24 * 60 * 60 * 1000;
  }
  return true;
}

export function matchesDuplicateExtensionFilter(group, extensionFilter) {
  if (!group || extensionFilter === "all") {
    return true;
  }
  const extensionSet = new Set(
    (group.files || [])
      .map((file) => duplicateFileExtension(file?.name))
      .filter((value) => value !== null)
  );
  if (!extensionSet.size) {
    return false;
  }
  if (extensionFilter === "sameExtension") {
    return extensionSet.size === 1;
  }
  if (extensionFilter === "crossExtension") {
    return extensionSet.size > 1;
  }
  return true;
}

export function matchesDuplicatePathFilter(group, pathFilter) {
  if (!group || pathFilter === "all") {
    return true;
  }
  const hasSimilar = hasSimilarParentPaths(group.files || []);
  if (pathFilter === "similar") {
    return hasSimilar;
  }
  if (pathFilter === "different") {
    return !hasSimilar;
  }
  return true;
}

export function normalizeComparePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

export function pathWithinScope(scopePath, candidatePath) {
  const normalizedScope = normalizeComparePath(scopePath);
  const normalizedCandidate = normalizeComparePath(candidatePath);
  if (!normalizedScope || !normalizedCandidate) return false;
  return normalizedCandidate === normalizedScope || normalizedCandidate.startsWith(`${normalizedScope}/`);
}

export function pathMatchesScope(candidatePath, scopePath) {
  return pathWithinScope(scopePath, candidatePath);
}

export function getComparedFolderSides(candidatePath, leftPath, rightPath) {
  const normalizedCandidate = normalizeComparePath(candidatePath);
  const normalizedLeft = normalizeComparePath(leftPath);
  const normalizedRight = normalizeComparePath(rightPath);
  const leftContainsRight = normalizedLeft && normalizedRight && pathWithinScope(normalizedLeft, normalizedRight);
  const rightContainsLeft = normalizedLeft && normalizedRight && pathWithinScope(normalizedRight, normalizedLeft);
  let inLeft = pathWithinScope(normalizedLeft, normalizedCandidate);
  let inRight = pathWithinScope(normalizedRight, normalizedCandidate);

  if (leftContainsRight && inRight) {
    inLeft = false;
  }
  if (rightContainsLeft && inLeft) {
    inRight = false;
  }
  return [inLeft, inRight];
}

function hasSimilarParentPaths(files = []) {
  const parents = [...new Set(
    files
      .map((file) => normalizeComparePath(file?.parentPath))
      .filter(Boolean)
  )];
  if (parents.length < 2) {
    return false;
  }
  for (let i = 0; i < parents.length; i += 1) {
    for (let j = i + 1; j < parents.length; j += 1) {
      if (arePathsSimilar(parents[i], parents[j])) {
        return true;
      }
    }
  }
  return false;
}

function arePathsSimilar(leftPath, rightPath) {
  if (!leftPath || !rightPath || leftPath === rightPath) {
    return false;
  }
  const leftParts = splitComparePath(leftPath);
  const rightParts = splitComparePath(rightPath);
  if (!leftParts.length || !rightParts.length) {
    return false;
  }
  const leftLast = normalizePathToken(leftParts[leftParts.length - 1]);
  const rightLast = normalizePathToken(rightParts[rightParts.length - 1]);
  const commonPrefix = commonPrefixLength(leftParts, rightParts);
  const prefixCoverage = commonPrefix / Math.max(leftParts.length, rightParts.length);

  if (leftLast && rightLast && leftLast === rightLast) {
    return true;
  }
  if (leftLast && rightLast && leftParts.length === rightParts.length && prefixCoverage >= 0.6) {
    return true;
  }
  if (prefixCoverage >= 0.7) {
    return true;
  }
  if (leftParts.length === rightParts.length) {
    let sameSegments = 0;
    for (let index = 0; index < leftParts.length; index += 1) {
      if (normalizePathToken(leftParts[index]) === normalizePathToken(rightParts[index])) {
        sameSegments += 1;
      }
    }
    if (sameSegments / leftParts.length >= 0.7) {
      return true;
    }
  }
  return false;
}

function splitComparePath(value) {
  return normalizeComparePath(value).split("/").filter(Boolean);
}

function commonPrefixLength(leftParts, rightParts) {
  let count = 0;
  const limit = Math.min(leftParts.length, rightParts.length);
  for (let index = 0; index < limit; index += 1) {
    if (normalizePathToken(leftParts[index]) !== normalizePathToken(rightParts[index])) {
      break;
    }
    count += 1;
  }
  return count;
}

function normalizePathToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.(copy|bak|backup)$/g, "")
    .replace(/[\s._-]+/g, "")
    .replace(/\((copy|\d+)\)$/g, "")
    .replace(/（(副本|\d+)）$/g, "")
    .replace(/(?:副本|复制|拷贝|copy|backup|备份)$/g, "");
}

function duplicateFileExtension(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return "";
  }
  return normalized.slice(dotIndex + 1);
}
