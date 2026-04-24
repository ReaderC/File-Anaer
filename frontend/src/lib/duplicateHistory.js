import { clearHistoryEntries, deleteHistoryEntry, listHistoryEntries, readHistoryEntry, saveHistoryEntry } from "./historyStore";

const STORE_NAME = "duplicate-history";

export function listDuplicateHistory(limit = 10) {
  return listHistoryEntries(STORE_NAME, limit);
}

export function saveDuplicateHistory(entry, limit = 10) {
  return saveHistoryEntry(STORE_NAME, entry, limit);
}

export function readDuplicateHistory(id) {
  return readHistoryEntry(STORE_NAME, id);
}

export function deleteDuplicateHistory(id, limit = 10) {
  return deleteHistoryEntry(STORE_NAME, id, limit);
}

export function clearDuplicateHistory() {
  return clearHistoryEntries(STORE_NAME);
}
