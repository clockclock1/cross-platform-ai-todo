import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');

let database: DatabaseSync | null = null;

export function dataDir() {
  return DATA_DIR;
}

export function getDb() {
  if (!database) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    database = new DatabaseSync(DB_FILE);
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        role_name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username));
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        due_date TEXT,
        due_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id, completed, created_at);
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        client_version TEXT NOT NULL,
        ip TEXT NOT NULL,
        last_active TEXT NOT NULL,
        status TEXT NOT NULL,
        sync_interval TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id, platform, name);
      CREATE TABLE IF NOT EXISTS sessions (
        jti TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT,
        expires_at INTEGER NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS verify_codes (
        email TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        last_sent_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        json TEXT NOT NULL
      );
    `);
  }
  return database;
}

export function tx(fn: () => void) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  }
}
