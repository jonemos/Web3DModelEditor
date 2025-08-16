// Lightweight SQLite (sql.js) wrapper for browser persistence
// - Stores DB in localStorage as a single base64 blob ("sqlite_db") to survive reloads
// - Provides simple table helpers used by idb.js (customMeshes) and viewGizmoConfig (appSettings)
// - Keeps API minimal and promise-based

import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_BLOB_KEY = 'sqlite_db';
const IDB_NAME = 'Web3DModelEditorSQLite';
const IDB_STORE = 'sqlite';
let SQL = null;
let db = null;
let initPromise = null;
const LEGACY_IDB_NAME = 'Web3DModelEditorDB';
const LEGACY_IDB_STORE = 'customMeshes';
const LEGACY_MIGRATION_FLAG = 'sqlite_legacy_migrated_v1';

// ---- Safe base64 helpers (avoid call stack overflow on large buffers) ----
function uint8ToBase64(uint8) {
  const CHUNK = 0x8000; // 32KB
  let binary = '';
  for (let i = 0; i < uint8.length; i += CHUNK) {
    const sub = uint8.subarray(i, Math.min(i + CHUNK, uint8.length));
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function abToBase64(ab) {
  if (ab instanceof Uint8Array) return uint8ToBase64(ab);
  return uint8ToBase64(new Uint8Array(ab));
}

function base64ToUint8(b64) {
  if (!b64) return new Uint8Array(0);
  const binary = atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const dbx = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbx.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const dbx = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = dbx.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const r = store.put(value, key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    console.error('IDB set failed:', e);
  }
}

async function loadFromStorage() {
  // Prefer IndexedDB blob
  const blob = await idbGet(DB_BLOB_KEY);
  if (blob) {
    try {
      const buf = await (blob.arrayBuffer ? blob.arrayBuffer() : blob);
      return new Uint8Array(buf);
    } catch {}
  }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(DB_BLOB_KEY);
    if (!raw) return null;
    return Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function saveToStorage() {
  try {
    const data = db.export();
    // Save to IndexedDB
    await idbSet(DB_BLOB_KEY, new Blob([data], { type: 'application/octet-stream' }));
    // Also save small mirror to localStorage (best effort)
    try {
  const b64 = abToBase64(data);
      localStorage.setItem(DB_BLOB_KEY, b64);
    } catch {}
  } catch (e) {
    console.error('SQLite save failed:', e);
  }
}

export async function getDB() {
  if (db) return db;
  if (!initPromise) {
    initPromise = (async () => {
      SQL = await initSqlJs({ locateFile: (file) => file.endsWith('sql-wasm.wasm') ? wasmUrl : file });
      const existing = await loadFromStorage();
      db = existing ? new SQL.Database(existing) : new SQL.Database();
      // Ensure required tables
      db.exec(`
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS custom_meshes (
  id TEXT PRIMARY KEY,
  name TEXT,
  data_b64 TEXT,
  thumbnail_b64 TEXT,
  created_at INTEGER
);
`);
      // One-time legacy migration from old IndexedDB store
      try {
        const migrated = localStorage.getItem(LEGACY_MIGRATION_FLAG);
        if (!migrated) {
          await migrateLegacyIndexedDB();
          localStorage.setItem(LEGACY_MIGRATION_FLAG, '1');
          persist();
        }
      } catch (e) {
        console.warn('Legacy migration skipped:', e);
      }
      return db;
    })();
  }
  return initPromise;
}

export function persist() {
  if (db) saveToStorage();
}

// App settings helpers
export async function settingsSet(key, valueObj) {
  const database = await getDB();
  const value = JSON.stringify(valueObj ?? null);
  const stmt = database.prepare('INSERT INTO app_settings(key, value) VALUES(?, ?)\nON CONFLICT(key) DO UPDATE SET value=excluded.value');
  stmt.run([key, value]);
  stmt.free();
  persist();
}

export async function settingsGet(key) {
  const database = await getDB();
  const stmt = database.prepare('SELECT value FROM app_settings WHERE key = ?');
  let out = null;
  if (stmt.step()) {
    try { out = JSON.parse(stmt.getAsObject().value); } catch { out = null; }
  }
  stmt.free();
  return out;
}

// Custom meshes helpers (compatible with prior idb.js usage)
export async function customMeshesGetAll() {
  const database = await getDB();
  const res = [];
  const stmt = database.prepare('SELECT id, name, data_b64, thumbnail_b64, created_at FROM custom_meshes ORDER BY created_at ASC');
  while (stmt.step()) {
    const row = stmt.getAsObject();
    res.push({
      id: row.id,
      name: row.name,
    glbData: row.data_b64 ? base64ToUint8(row.data_b64).buffer : null,
      thumbnail: row.thumbnail_b64 || null,
      createdAt: row.created_at
    });
  }
  stmt.free();
  return res;
}

export async function customMeshesUpsert(mesh) {
  const database = await getDB();
  const { id, name, data, glbData, thumbnail } = mesh;
  const bin = data || glbData || null;
  const data_b64 = bin ? abToBase64(bin instanceof Uint8Array ? bin : new Uint8Array(bin)) : null;
  const thumbnail_b64 = typeof thumbnail === 'string' ? thumbnail : null;
  const created_at = Date.now();
  const stmt = database.prepare('INSERT INTO custom_meshes(id, name, data_b64, thumbnail_b64, created_at) VALUES(?, ?, ?, ?, ?)\nON CONFLICT(id) DO UPDATE SET name=excluded.name, data_b64=excluded.data_b64, thumbnail_b64=excluded.thumbnail_b64');
  stmt.run([id, name ?? '', data_b64, thumbnail_b64, created_at]);
  stmt.free();
  persist();
}

export async function customMeshesDelete(id) {
  const database = await getDB();
  const stmt = database.prepare('DELETE FROM custom_meshes WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persist();
}

// ----- Legacy migration -----
async function migrateLegacyIndexedDB() {
  const hasIDB = typeof indexedDB !== 'undefined';
  if (!hasIDB) return;
  const legacy = await new Promise((resolve) => {
    const req = indexedDB.open(LEGACY_IDB_NAME);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const d = req.result;
      // 레거시 오브젝트 스토어 존재 여부 확인 후에만 마이그레이션
      try {
        if (!d.objectStoreNames || !d.objectStoreNames.contains(LEGACY_IDB_STORE)) {
          return resolve([]);
        }
        const tx = d.transaction(LEGACY_IDB_STORE, 'readonly');
        const st = tx.objectStore(LEGACY_IDB_STORE);
        const gr = st.getAll();
        gr.onsuccess = () => resolve(gr.result || []);
        gr.onerror = () => resolve(null);
      } catch (e) {
        // 일부 브라우저에서 NotFoundError 등 발생 시 스킵
        resolve([]);
      }
    };
  });
  if (!legacy || !Array.isArray(legacy) || legacy.length === 0) return;
  for (const m of legacy) {
    try {
      await customMeshesUpsert({ id: m.id, name: m.name, glbData: m.glbData, thumbnail: m.thumbnail });
    } catch {}
  }
}
