"use client";

/**
 * A very small IndexedDB wrapper — enough for the two things Ink stores on the
 * device and no more. localStorage isn't an option here: it's synchronous, it
 * caps out around 5MB, and it can't hold the image Blobs attached to a draft
 * written offline.
 *
 * `drafts` — posts written with no network, waiting to be sent.
 * `cache`  — the last feed we successfully loaded, so the app opens to your
 *            own writing instead of a spinner when you're offline.
 */

const DB_NAME = "ink";
const DB_VERSION = 1;

export const DRAFTS = "drafts";
export const CACHE = "cache";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CACHE)) {
        db.createObjectStore(CACHE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // A failed open shouldn't poison every later call (private browsing, quota).
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return run<T | undefined>(store, "readonly", (s) => s.get(key));
}

export function idbGetAll<T>(store: string): Promise<T[]> {
  return run<T[]>(store, "readonly", (s) => s.getAll());
}

export function idbPut(store: string, value: unknown, key?: string) {
  return run(store, "readwrite", (s) =>
    key === undefined ? s.put(value) : s.put(value, key)
  );
}

export function idbDelete(store: string, key: string) {
  return run(store, "readwrite", (s) => s.delete(key));
}

/** True when IndexedDB is usable at all — it isn't during SSR. */
export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
