import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('mira_vault.db');

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

    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT DEFAULT '',
      is_enabled INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 99,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      input_type TEXT DEFAULT 'all',
      is_enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 99,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );

    CREATE TABLE IF NOT EXISTS routing_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      input_type TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_msg TEXT DEFAULT ''
    );
  `);

  // Generate anchor_id once
  const identity = db.getFirstSync('SELECT anchor_id FROM mira_identity LIMIT 1');
  if (!identity) {
    const anchorId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    const now = new Date().toISOString();
    db.runSync('INSERT INTO mira_identity (anchor_id, created_at) VALUES (?, ?)', [anchorId, now]);
    addAuditLog('IDENTITY_CREATED', `anchor_id: ${anchorId}`);
  }

  // Seed default providers
  const providerCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM providers');
  if (providerCount?.count === 0) {
    seedDefaultProviders();
  }
}

function seedDefaultProviders() {
  const now = new Date().toISOString();
  const defaults = [
    { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1/chat/completions', priority: 1 },
    { name: 'Groq', base_url: 'https://api.groq.com/openai/v1/chat/completions', priority: 2 },
    { name: 'HuggingFace', base_url: 'https://api-inference.huggingface.co/v1/chat/completions', priority: 3 },
    { name: 'Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', priority: 4 },
    { name: 'OpenAI', base_url: 'https://api.openai.com/v1/chat/completions', priority: 5 },
    { name: 'Claude', base_url: 'https://api.anthropic.com/v1/messages', priority: 6 },
    { name: 'Mistral', base_url: 'https://api.mistral.ai/v1/chat/completions', priority: 7 },
  ];

  defaults.forEach(p => {
    db.runSync(
      'INSERT INTO providers (name, base_url, api_key, is_enabled, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [p.name, p.base_url, '', 0, p.priority, now]
    );
  });

  addAuditLog('PROVIDERS_SEEDED', 'Default providers initialized');
}

// ─── Identity ────────────────────────────────────────────────
export function getAnchorId(): string {
  const row = db.getFirstSync<{ anchor_id: string }>('SELECT anchor_id FROM mira_identity LIMIT 1');
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
    'SELECT * FROM memories WHERE is_permanent_deleted = 0 AND deleted_at IS NULL ORDER BY importance_score DESC'
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

// ─── Providers ───────────────────────────────────────────────
export function getProviders(): Provider[] {
  return db.getAllSync<Provider>('SELECT * FROM providers ORDER BY priority ASC');
}

export function getEnabledProviders(): Provider[] {
  return db.getAllSync<Provider>('SELECT * FROM providers WHERE is_enabled = 1 ORDER BY priority ASC');
}

export function updateProviderKey(id: number, apiKey: string) {
  db.runSync('UPDATE providers SET api_key = ?, is_enabled = 1 WHERE id = ?', [apiKey, id]);
  addAuditLog('PROVIDER_KEY_SET', `Provider ID: ${id}`);
}

export function toggleProvider(id: number, enabled: boolean) {
  db.runSync('UPDATE providers SET is_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  addAuditLog('PROVIDER_TOGGLE', `ID: ${id} → ${enabled ? 'ON' : 'OFF'}`);
}

export function updateProviderPriority(id: number, priority: number) {
  db.runSync('UPDATE providers SET priority = ? WHERE id = ?', [priority, id]);
}

// ─── Models ──────────────────────────────────────────────────
export function getModelsForProvider(providerId: number): AIModel[] {
  return db.getAllSync<AIModel>(
    'SELECT * FROM models WHERE provider_id = ? AND is_enabled = 1 ORDER BY priority ASC',
    [providerId]
  );
}

export function getModelsForType(inputType: string): AIModel[] {
  return db.getAllSync<AIModel>(
    `SELECT m.*, p.name as provider_name, p.base_url, p.api_key 
     FROM models m 
     JOIN providers p ON m.provider_id = p.id 
     WHERE p.is_enabled = 1 AND m.is_enabled = 1 
     AND (m.input_type = ? OR m.input_type = 'all')
     ORDER BY p.priority ASC, m.priority ASC`,
    [inputType]
  );
}

export function addModel(providerId: number, modelId: string, modelName: string, inputType: string = 'all') {
  db.runSync(
    'INSERT INTO models (provider_id, model_id, model_name, input_type, is_enabled, priority) VALUES (?, ?, ?, ?, 1, 99)',
    [providerId, modelId, modelName, inputType]
  );
  addAuditLog('MODEL_ADDED', `Provider: ${providerId} | Model: ${modelId} | Type: ${inputType}`);
}

export function updateProviderUrl(id: number, url: string) {
  db.runSync('UPDATE providers SET base_url = ? WHERE id = ?', [url, id]);
  addAuditLog('PROVIDER_URL_CHANGED', `ID: ${id} → ${url}`);
}

export function toggleModel(id: number, enabled: boolean) {
  db.runSync('UPDATE models SET is_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

export function deleteModel(id: number) {
  db.runSync('DELETE FROM models WHERE id = ?', [id]);
  addAuditLog('MODEL_DELETED', `ID: ${id}`);
}

// ─── Routing Log ─────────────────────────────────────────────
export function addRoutingLog(inputType: string, providerName: string, modelId: string, success: boolean, errorMsg: string = '') {
  const now = new Date().toISOString();
  db.runSync(
    'INSERT INTO routing_log (timestamp, input_type, provider_name, model_id, success, error_msg) VALUES (?, ?, ?, ?, ?, ?)',
    [now, inputType, providerName, modelId, success ? 1 : 0, errorMsg]
  );
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
  return db.getAllSync<AuditLog>('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 500');
}

// ─── Settings ────────────────────────────────────────────────
export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  addAuditLog('SETTING_CHANGED', `Key: ${key}`);
}

// ─── Backup & Restore ────────────────────────────────────────
export function exportVault() {
  const memories = db.getAllSync('SELECT * FROM memories');
  const settings = db.getAllSync('SELECT * FROM settings');
  const identity = db.getAllSync('SELECT * FROM mira_identity');
  const providers = db.getAllSync('SELECT * FROM providers');
  const models = db.getAllSync('SELECT * FROM models');
  return JSON.stringify({ memories, settings, identity, providers, models, exportedAt: new Date().toISOString() });
}

export function importVault(jsonData: string) {
  try {
    const data = JSON.parse(jsonData);
    db.execSync('DELETE FROM memories; DELETE FROM settings; DELETE FROM providers; DELETE FROM models;');
    data.memories?.forEach((m: Memory) => {
      db.runSync(
        'INSERT INTO memories (content, importance_score, tags, created_at, deleted_at, is_permanent_deleted) VALUES (?, ?, ?, ?, ?, ?)',
        [m.content, m.importance_score, m.tags, m.created_at, m.deleted_at, m.is_permanent_deleted]
      );
    });
    data.settings?.forEach((s: { key: string; value: string }) => {
      db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    });
    data.providers?.forEach((p: Provider) => {
      db.runSync(
        'INSERT INTO providers (name, base_url, api_key, is_enabled, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.base_url, p.api_key, p.is_enabled, p.priority, p.created_at]
      );
    });
    data.models?.forEach((m: AIModel) => {
      db.runSync(
        'INSERT INTO models (provider_id, model_id, model_name, input_type, is_enabled, priority) VALUES (?, ?, ?, ?, ?, ?)',
        [m.provider_id, m.model_id, m.model_name, m.input_type, m.is_enabled, m.priority]
      );
    });
    addAuditLog('VAULT_RESTORED', `Imported ${data.memories?.length ?? 0} memories, ${data.providers?.length ?? 0} providers`);
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

export interface Provider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  is_enabled: number;
  priority: number;
  created_at: string;
}

export interface AIModel {
  id: number;
  provider_id: number;
  model_id: string;
  model_name: string;
  input_type: string;
  is_enabled: number;
  priority: number;
  provider_name?: string;
  base_url?: string;
  api_key?: string;
}

// ─── Local Providers ─────────────────────────────────────────
export function getLocalProviders(): LocalProvider[] {
  return db.getAllSync<LocalProvider>(
    "SELECT * FROM providers WHERE name LIKE 'Local:%' AND is_enabled = 1 ORDER BY priority ASC"
  );
}

export function addLocalProvider(name: string, url: string) {
  const now = new Date().toISOString();
  const fullName = `Local: ${name}`;
  const existing = db.getFirstSync('SELECT id FROM providers WHERE name = ?', [fullName]);
  if (existing) {
    db.runSync('UPDATE providers SET base_url = ?, is_enabled = 1 WHERE name = ?', [url, fullName]);
  } else {
    db.runSync(
      'INSERT INTO providers (name, base_url, api_key, is_enabled, priority, created_at) VALUES (?, ?, ?, 1, 0, ?)',
      [fullName, url, 'local', now]
    );
  }
  addAuditLog('LOCAL_PROVIDER_ADDED', `${fullName} → ${url}`);
}

export interface LocalProvider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  is_enabled: number;
  priority: number;
  created_at: string;
}
