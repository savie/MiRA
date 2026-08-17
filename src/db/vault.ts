import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

const db = SQLite.openDatabaseSync('mira_vault.db');

export function initDB() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS mira_identity (
      anchor_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      importance_score REAL DEFAULT 0.5,
      tags TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      is_permanent_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Generate anchor_id once on first launch
  const identity = db.getFirstSync('SELECT anchor_id FROM mira_identity LIMIT 1');
  if (!identity) {
    const anchorId = uuidv4();
    const now = new Date().toISOString();
    db.runSync(
      'INSERT INTO mira_identity (anchor_id, created_at) VALUES (?, ?)',
      [anchorId, now]
    );
    addAuditLog('IDENTITY_CREATED', `anchor_id: ${anchorId}`);
  }
}

// ─── Identity ───────────────────────────────────────────────
export function getAnchorId(): string {
  const row = db.getFirstSync<{ anchor_id: string }>(
    'SELECT anchor_id FROM mira_identity LIMIT 1'
  );
  return row?.anchor_id ?? 'unknown';
}

// ─── Memories ────────────────────────────────────────────────
export function saveMemory(content: string, tags: string = '', importance: number = 0.5) {
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO memories (content, importance_score, tags, created_at) VALUES (?, ?, ?, ?)',
    [content, importance, tags, now]
  );
  addAuditLog('MEMORY_SAVED', `ID: ${result.lastInsertRowId} | Tags: ${tags}`);
  return result.lastInsertRowId;
}

export function getMemories(): Memory[] {
  return db.getAllSync<Memory>(
    'SELECT * FROM memories WHERE is_permanent_deleted = 0 AND deleted_at IS NULL ORDER BY created_at DESC'
  );
}

export function searchMemories(query: string): Memory[] {
  return db.getAllSync<Memory>(
    `SELECT * FROM memories WHERE is_permanent_deleted = 0 AND deleted_at IS NULL 
     AND (content LIKE ? OR tags LIKE ?) ORDER BY importance_score DESC`,
    [`%${query}%`, `%${query}%`]
  );
}

export function softDeleteMemory(id: number) {
  const now = new Date().toISOString();
  db.runSync('UPDATE memories SET deleted_at = ? WHERE id = ?', [now, id]);
  addAuditLog('MEMORY_SOFT_DELETE', `ID: ${id}`);
}

export function permanentDeleteMemory(id: number) {
  db.runSync('UPDATE memories SET is_permanent_deleted = 1 WHERE id = ?', [id]);
  addAuditLog('MEMORY_PERMANENT_DELETE', `ID: ${id} | Reason: Owner Request`);
}

// ─── Audit Log ───────────────────────────────────────────────
export function addAuditLog(eventType: string, detail: string) {
  const now = new Date().toISOString();
  db.runSync(
    'INSERT INTO audit_log (timestamp, event_type, detail) VALUES (?, ?, ?)',
    [now, eventType, detail]
  );
}

export function getAuditLogs(): AuditLog[] {
  return db.getAllSync<AuditLog>(
    'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 500'
  );
}

// ─── Settings ────────────────────────────────────────────────
export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
  addAuditLog('SETTING_CHANGED', `Key: ${key}`);
}

// ─── Backup & Restore ────────────────────────────────────────
export function exportVault() {
  const memories = db.getAllSync('SELECT * FROM memories');
  const settings = db.getAllSync('SELECT * FROM settings');
  const identity = db.getAllSync('SELECT * FROM mira_identity');
  return JSON.stringify({ memories, settings, identity, exportedAt: new Date().toISOString() });
}

export function importVault(jsonData: string) {
  try {
    const data = JSON.parse(jsonData);
    db.execSync('DELETE FROM memories; DELETE FROM settings;');
    data.memories?.forEach((m: Memory) => {
      db.runSync(
        'INSERT INTO memories (content, importance_score, tags, created_at, deleted_at, is_permanent_deleted) VALUES (?, ?, ?, ?, ?, ?)',
        [m.content, m.importance_score, m.tags, m.created_at, m.deleted_at, m.is_permanent_deleted]
      );
    });
    data.settings?.forEach((s: { key: string; value: string }) => {
      db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    });
    addAuditLog('VAULT_RESTORED', `Imported ${data.memories?.length ?? 0} memories`);
    return true;
  } catch {
    return false;
  }
}

// ─── Types ───────────────────────────────────────────────────
export interface Memory {
  id: number;
  content: string;
  importance_score: number;
  tags: string;
  created_at: string;
  deleted_at: string | null;
  is_permanent_deleted: number;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  event_type: string;
  detail: string;
}
