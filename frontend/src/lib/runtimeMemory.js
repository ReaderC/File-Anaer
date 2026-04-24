import { releaseRuntimeMemory, releaseRuntimeMemoryBeacon } from "../api/client";

const memoryResetters = new Map();

export function registerMemoryResetter(key, resetter) {
  if (!key || typeof resetter !== "function") {
    return () => {};
  }
  memoryResetters.set(key, resetter);
  return () => {
    if (memoryResetters.get(key) === resetter) {
      memoryResetters.delete(key);
    }
  };
}

export function resetRegisteredMemory() {
  for (const resetter of memoryResetters.values()) {
    try {
      resetter();
    } catch (_error) {
      // Ignore local reset errors and continue clearing the remaining stores.
    }
  }
}

export async function releaseAllRuntimeMemory() {
  resetRegisteredMemory();
  await releaseRuntimeMemory({ clearAll: true });
}

export function releaseAllRuntimeMemoryOnUnload() {
  resetRegisteredMemory();
  releaseRuntimeMemoryBeacon({ clearAll: true });
}
