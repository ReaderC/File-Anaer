import {
  clearHistoryEntries as clearHistoryEntriesRequest,
  deleteHistoryEntry as deleteHistoryEntryRequest,
  fetchHistoryEntry as fetchHistoryEntryRequest,
  fetchHistoryEntries,
  saveHistoryEntry as saveHistoryEntryRequest
} from "../api/client";

export async function listHistoryEntries(storeName, limit = 10) {
  const payload = await fetchHistoryEntries(storeName, limit);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function saveHistoryEntry(storeName, entry, limit = 10) {
  const payload = await saveHistoryEntryRequest(storeName, entry, limit);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function readHistoryEntry(storeName, id) {
  if (!id) {
    return null;
  }
  const payload = await fetchHistoryEntryRequest(storeName, id);
  return payload && typeof payload === "object" ? payload : null;
}

export async function deleteHistoryEntry(storeName, id, limit = 10) {
  if (!id) {
    return [];
  }
  const payload = await deleteHistoryEntryRequest(storeName, id, limit);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function clearHistoryEntries(storeName) {
  const payload = await clearHistoryEntriesRequest(storeName);
  return Array.isArray(payload?.items) ? payload.items : [];
}
