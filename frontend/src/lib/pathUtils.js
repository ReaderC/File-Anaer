export function pathLabel(value) {
  if (!value) {
    return "";
  }
  const normalized = value.replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || value;
}

export function parentPath(currentPath, rootPath) {
  if (!currentPath || currentPath === rootPath) {
    return rootPath;
  }
  const normalized = currentPath.replace(/\/+$/, "");
  const parts = normalized.split("/");
  parts.pop();
  const next = parts.join("/") || "/";
  return next.length < rootPath.length ? rootPath : next;
}

export function findRootForPath(roots = [], targetPath = "") {
  if (!targetPath) {
    return "";
  }
  const normalizedTarget = targetPath.replace(/\\/g, "/");
  return [...roots]
    .sort((left, right) => right.length - left.length)
    .find((root) => {
      const normalizedRoot = root.replace(/\\/g, "/");
      return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
    }) || "";
}

export function deriveHostPath(path, rootPath, rootHostPath) {
  if (!path || !rootPath || !rootHostPath) {
    return "";
  }
  if (path === rootPath) {
    return rootHostPath;
  }
  if (!path.startsWith(`${rootPath}/`)) {
    return "";
  }
  return `${rootHostPath}/${path.slice(rootPath.length + 1)}`;
}
