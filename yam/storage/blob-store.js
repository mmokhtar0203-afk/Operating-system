// IndexedDB adapter for binary files (images, drawings, datasheets, approval evidence).
// Metadata lives in the structured database (files table); only the Blob lives here.
const DB_NAME = 'yam-files';
const STORE = 'blobs';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    const r = fn(store);
    if (r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const BlobStore = {
  put: (id, blob) => run('readwrite', (s) => s.put(blob, id)),
  get: (id) => run('readonly', (s) => s.get(id)),
  delete: (id) => run('readwrite', (s) => s.delete(id)),
  clear: () => run('readwrite', (s) => s.clear()),
  keys: () => run('readonly', (s) => s.getAllKeys()),
  async putMany(entries) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const s = tx.objectStore(STORE);
      for (const [id, blob] of entries) s.put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async estimate() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return null;
  },
};
