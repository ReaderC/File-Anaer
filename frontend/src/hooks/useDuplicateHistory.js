import { useEffect, useRef, useState } from "react";
import { clearDuplicateHistory, deleteDuplicateHistory, listDuplicateHistory, readDuplicateHistory, saveDuplicateHistory } from "../lib/duplicateHistory";

export default function useDuplicateHistory({
  getHistoryEntry,
  historyLimit,
  job,
  requestFailedMessage,
  restoreEntry,
  restoreSuccessMessage,
  t,
  toast
}) {
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringHistoryId, setRestoringHistoryId] = useState("");
  const historyRef = useRef(null);
  const lastStoredHistoryKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    listDuplicateHistory(historyLimit)
      .then((entries) => {
        if (!cancelled) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyLimit]);

  useEffect(() => {
    if (!historyOpen) {
      return undefined;
    }

    let cancelled = false;
    setHistoryLoading(true);
    listDuplicateHistory(historyLimit)
      .then((entries) => {
        if (!cancelled) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [historyLimit, historyOpen]);

  useEffect(() => {
    if (job?.status !== "done" || !job?.result) return;
    const entry = getHistoryEntry(job);
    if (!entry) return;
    const saveKey = `${entry.id}|${entry.savedAt}`;
    if (lastStoredHistoryKeyRef.current === saveKey) return;
    lastStoredHistoryKeyRef.current = saveKey;
    saveDuplicateHistory(entry, historyLimit).then(setHistoryEntries).catch(() => toast.showToast(t("messages.historySaveFailed")));
  }, [getHistoryEntry, historyLimit, job, t, toast]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (historyRef.current?.contains(event.target)) return;
      setHistoryOpen(false);
    }
    if (!historyOpen) return undefined;
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [historyOpen]);

  async function handleHistoryClear() {
    try {
      setHistoryEntries(await clearDuplicateHistory());
      toast.showToast(t("messages.historyCleared"));
    } catch (historyError) {
      toast.showToast(historyError.message || requestFailedMessage);
    }
  }

  async function handleHistoryDelete(entryId) {
    try {
      setHistoryEntries(await deleteDuplicateHistory(entryId, historyLimit));
      toast.showToast(t("messages.historyRemoved"));
    } catch (historyError) {
      toast.showToast(historyError.message || requestFailedMessage);
    }
  }

  async function restoreHistoryEntry(entrySummary) {
    if (!entrySummary?.id) return;
    setRestoringHistoryId(entrySummary.id);
    const entry = await readDuplicateHistory(entrySummary.id).catch((historyError) => {
      toast.showToast(historyError.message || requestFailedMessage);
      return null;
    });
    if (!entry?.result?.groups) {
      setRestoringHistoryId("");
      return;
    }
    lastStoredHistoryKeyRef.current = `${entry.id}|${entry.savedAt || entry.createdAt || ""}`;
    restoreEntry(entry);
    setHistoryOpen(false);
    setRestoringHistoryId("");
    toast.showToast(restoreSuccessMessage);
  }

  function appendHistoryEntry(entry) {
    if (!entry) return;
    const saveKey = `${entry.id}|${entry.savedAt}`;
    lastStoredHistoryKeyRef.current = saveKey;
    saveDuplicateHistory(entry, historyLimit).then(setHistoryEntries).catch(() => toast.showToast(t("messages.historySaveFailed")));
  }

  useEffect(() => {
    if (!job) {
      lastStoredHistoryKeyRef.current = "";
    }
  }, [job]);

  return {
    appendHistoryEntry,
    handleHistoryClear,
    handleHistoryDelete,
    historyEntries,
    historyLoading,
    historyOpen,
    historyRef,
    restoringHistoryId,
    restoreHistoryEntry,
    setHistoryOpen
  };
}
