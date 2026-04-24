import { clearHistoryEntries, deleteHistoryEntry, listHistoryEntries, saveHistoryEntry } from "./historyStore";

const STORE_NAME = "duplicate-action-log";

export function listDuplicateActionLogs(limit = 12) {
  return listHistoryEntries(STORE_NAME, limit);
}

export function saveDuplicateActionLog(entry, limit = 12) {
  return saveHistoryEntry(STORE_NAME, entry, limit);
}

export function deleteDuplicateActionLog(id, limit = 12) {
  return deleteHistoryEntry(STORE_NAME, id, limit);
}

export function clearDuplicateActionLogs() {
  return clearHistoryEntries(STORE_NAME);
}
