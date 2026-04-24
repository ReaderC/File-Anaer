import { clearHistoryEntries, deleteHistoryEntry, listHistoryEntries, readHistoryEntry, saveHistoryEntry } from "./historyStore";

const STORE_NAME = "analysis-history";

export function listAnalysisHistory(limit = 10) {
  return listHistoryEntries(STORE_NAME, limit);
}

export function saveAnalysisHistory(entry, limit = 10) {
  return saveHistoryEntry(STORE_NAME, entry, limit);
}

export function readAnalysisHistory(id) {
  return readHistoryEntry(STORE_NAME, id);
}

export function deleteAnalysisHistory(id, limit = 10) {
  return deleteHistoryEntry(STORE_NAME, id, limit);
}

export function clearAnalysisHistory() {
  return clearHistoryEntries(STORE_NAME);
}
