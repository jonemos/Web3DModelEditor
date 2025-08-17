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
// One-time localStorage -> SQLite migration flag for maps
const MAPS_MIGRATION_FLAG = 'sqlite_maps_migrated_v1';

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

// ---- Schema upgrade helpers ----
function tableHasColumn(database, table, column) {
  try {
    const stmt = database.prepare(`PRAGMA table_info(${table});`);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (String(row.name) === String(column)) {
        stmt.free();
        return true;
      }
    }
    stmt.free();
  } catch {}
  return false;
}

function ensureSchemaUpgrades(database) {
  let changed = false;
  try {
    // Add thumbnail_str if missing (custom_meshes)
    if (!tableHasColumn(database, 'custom_meshes', 'thumbnail_str')) {
      database.exec('ALTER TABLE custom_meshes ADD COLUMN thumbnail_str TEXT;');
      changed = true;
    }
  } catch (e) {
    console.warn('Schema upgrade skipped:', e);
  }
  return changed;
}

export async function getDB() {
  if (db) { try { if (ensureSchemaUpgrades(db)) persist(); } catch {} return db; }
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
  -- Deprecated: data_b64 / thumbnail_b64 kept for backward-compat; new flow stores blobs in IDB
  data_b64 TEXT,
  thumbnail_b64 TEXT,
  -- Optional lightweight string metadata for thumbnail (e.g. mime or note)
  thumbnail_str TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS saved_maps (
  name TEXT PRIMARY KEY,
  data_json TEXT,
  version INTEGER,
  updated_at INTEGER
);
`);
      // Apply in-place schema upgrades for existing DBs
  try { if (ensureSchemaUpgrades(db)) persist(); } catch {}
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
      // One-time migration of maps from localStorage (map_*) to SQLite
      try {
        const mflag = localStorage.getItem(MAPS_MIGRATION_FLAG);
        if (!mflag) {
          await migrateMapsFromLocalStorage();
          localStorage.setItem(MAPS_MIGRATION_FLAG, '1');
          persist();
        }
      } catch (e) {
        console.warn('Maps migration skipped:', e);
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
  let stmt;
  try {
    stmt = database.prepare('SELECT id, name, data_b64, thumbnail_b64, thumbnail_str, created_at FROM custom_meshes ORDER BY created_at ASC');
  } catch {
    // Fallback for older DBs without the column
    stmt = database.prepare('SELECT id, name, data_b64, thumbnail_b64, created_at FROM custom_meshes ORDER BY created_at ASC');
  }
  while (stmt.step()) {
    const row = stmt.getAsObject();
    res.push({
      id: row.id,
      name: row.name,
      // Legacy fields returned for backward-compat (callers may ignore)
      glbData: row.data_b64 ? base64ToUint8(row.data_b64).buffer : null,
      thumbnail: row.thumbnail_b64 || row.thumbnail_str || null,
      createdAt: row.created_at
    });
  }
  stmt.free();
  return res;
}

export async function customMeshesUpsert(mesh) {
  const database = await getDB();
  const { id, name, data, glbData, thumbnail, thumbnailStr } = mesh;
  const bin = data || glbData || null;
  const data_b64 = bin ? abToBase64(bin instanceof Uint8Array ? bin : new Uint8Array(bin)) : null;
  // Prefer non-binary thumbnail string meta when provided
  const thumbnail_b64 = typeof thumbnail === 'string' ? thumbnail : null;
  const thumbnail_str = typeof thumbnailStr === 'string' ? thumbnailStr : null;
  const created_at = Date.now();
  let stmt;
  try {
    stmt = database.prepare('INSERT INTO custom_meshes(id, name, data_b64, thumbnail_b64, thumbnail_str, created_at) VALUES(?, ?, ?, ?, ?, ?)\nON CONFLICT(id) DO UPDATE SET name=excluded.name, data_b64=excluded.data_b64, thumbnail_b64=excluded.thumbnail_b64, thumbnail_str=excluded.thumbnail_str');
    stmt.run([id, name ?? '', data_b64, thumbnail_b64, thumbnail_str, created_at]);
    stmt.free();
  } catch {
    // Fallback for DB without thumbnail_str
    stmt = database.prepare('INSERT INTO custom_meshes(id, name, data_b64, thumbnail_b64, created_at) VALUES(?, ?, ?, ?, ?)\nON CONFLICT(id) DO UPDATE SET name=excluded.name, data_b64=excluded.data_b64, thumbnail_b64=excluded.thumbnail_b64');
    stmt.run([id, name ?? '', data_b64, thumbnail_b64, created_at]);
    stmt.free();
  }
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

// ----- Maps: CRUD helpers backed by SQLite -----

export async function mapsUpsert(name, dataObj, version = 1) {
  const database = await getDB();
  const updated_at = Date.now();
  let data_json = null;
  try { data_json = JSON.stringify(dataObj ?? {}); } catch { data_json = '{}'; }
  const stmt = database.prepare('INSERT INTO saved_maps(name, data_json, version, updated_at) VALUES(?, ?, ?, ?)\nON CONFLICT(name) DO UPDATE SET data_json=excluded.data_json, version=excluded.version, updated_at=excluded.updated_at');
  stmt.run([String(name || ''), data_json, Number.isFinite(version) ? version : 1, updated_at]);
  stmt.free();
  persist();
}

export async function mapsGet(name) {
  const database = await getDB();
  const stmt = database.prepare('SELECT data_json, version, updated_at FROM saved_maps WHERE name = ?');
  let out = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    try {
      out = JSON.parse(row.data_json || '{}');
    } catch {
      out = null;
    }
    if (out && typeof out === 'object' && !('__version' in out)) {
      out.__version = Number.isFinite(row.version) ? row.version : 1;
    }
  }
  stmt.free();
  return out;
}

export async function mapsList() {
  const database = await getDB();
  const stmt = database.prepare('SELECT name, version, updated_at FROM saved_maps ORDER BY updated_at DESC');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export async function mapsDelete(name) {
  const database = await getDB();
  const stmt = database.prepare('DELETE FROM saved_maps WHERE name = ?');
  stmt.run([String(name || '')]);
  stmt.free();
  persist();
}

// Migrate maps stored as localStorage keys `map_*` into SQLite
async function migrateMapsFromLocalStorage() {
  try {
    const keys = Object.keys(localStorage || {});
    const mapKeys = keys.filter(k => k.startsWith('map_'));
    if (mapKeys.length === 0) return;
    for (const k of mapKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') continue;
        if (!('__version' in obj)) obj.__version = 1;
        const name = k.substring(4);
        await mapsUpsert(name, obj, obj.__version || 1);
      } catch {}
    }
  } catch {}
}
