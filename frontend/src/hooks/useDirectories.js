import { useCallback, useEffect, useState } from "react";
import { fetchDirectories } from "../api/client";

const directoryCache = new Map();
const pendingDirectoryRequests = new Map();

function buildCacheKey(root, path, includeFiles) {
  return `${root}::${path}::${includeFiles ? "files" : "dirs"}`;
}

function requestDirectories(root, path, includeFiles, force = false) {
  const cacheKey = buildCacheKey(root, path, includeFiles);
  if (!force && directoryCache.has(cacheKey)) {
    return Promise.resolve(directoryCache.get(cacheKey));
  }

  if (pendingDirectoryRequests.has(cacheKey)) {
    return pendingDirectoryRequests.get(cacheKey);
  }

  const request = fetchDirectories(root, path, includeFiles)
    .then((payload) => {
      directoryCache.set(cacheKey, payload);
      pendingDirectoryRequests.delete(cacheKey);
      return payload;
    })
    .catch((error) => {
      pendingDirectoryRequests.delete(cacheKey);
      throw error;
    });

  pendingDirectoryRequests.set(cacheKey, request);
  return request;
}

export default function useDirectories(root, path, includeFiles = false) {
  const [state, setState] = useState({ items: [], loading: false, error: "", currentPath: path });

  const load = useCallback((force = false) => {
    if (!root || !path) {
      return Promise.resolve();
    }

    let active = true;
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
      currentPath: path
    }));

    const request = requestDirectories(root, path, includeFiles, force)
      .then((payload) => {
        if (!active) {
          return payload;
        }
        setState({
          items: payload.items ?? [],
          loading: false,
          error: "",
          currentPath: payload.path ?? path
        });
        return payload;
      })
      .catch((error) => {
        if (!active) {
          throw error;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
          currentPath: path
        }));
        throw error;
      });

    return {
      request,
      cancel: () => {
        active = false;
      }
    };
  }, [includeFiles, path, root]);

  useEffect(() => {
    if (!root || !path) {
      return;
    }

    const cached = directoryCache.get(buildCacheKey(root, path, includeFiles));
    if (cached) {
      setState({
        items: cached.items ?? [],
        loading: false,
        error: "",
        currentPath: cached.path ?? path
      });
      return;
    }

    const controller = load(false);
    return () => {
      controller?.cancel?.();
    };
  }, [includeFiles, load, path, root]);

  const refresh = useCallback(() => {
    const controller = load(true);
    return controller?.request ?? Promise.resolve();
  }, [load]);

  return {
    ...state,
    refresh
  };
}
