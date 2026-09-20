import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { dataDir, getDb, tx } from './db.js';
import {
  AppSettings,
  ClientPlatform,
  DeviceRecord,
  Priority,
  TodoRecord,
  UserRecord,
  UserRole,
  UserStatus,
} from './types.js';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const PLATFORMS: ClientPlatform[] = ['web', 'desktop-rust', 'mobile-uniapp'];
const MAX_DEVICES = 10;

function defaultSettings(): AppSettings {
  return {
    ai: {
      model: 'gemini-2.5-flash',
      temperature: 0.2,
      autoCategorize: true,
      defaultPriority: 'medium',
      customPrompt: '作为专业的待办助手，请保持精炼客观，准确解析截止日期和重要级别。',
      enableIntentAutoExecute: true,
    },
    sync: {
      autoSyncInterval: 5,
      enableOfflineSQLite: true,
      desktopGlobalHotkey: 'Cmd+Shift+T',
      hapticFeedback: true,
      soundOnComplete: true,
      autoPurgeDays: 30,
    },
    categories: [
      { id: 'cat-1', name: '工作', color: '#3b82f6', icon: 'Briefcase', isSystem: true },
      { id: 'cat-2', name: '学习', color: '#8b5cf6', icon: 'BookOpen', isSystem: true },
      { id: 'cat-3', name: '生活', color: '#10b981', icon: 'Coffee', isSystem: true },
      { id: 'cat-4', name: '健康', color: '#f43f5e', icon: 'Activity', isSystem: true },
      { id: 'cat-5', name: '灵感', color: '#f59e0b', icon: 'Lightbulb', isSystem: true },
    ],
    apiConfig: {
      webhookUrl: '',
      enablePublicApi: true,
      corsOrigins: 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000',
    },
    mail: {
      enabled: false,
      channel: 'netease',
      fromName: 'AI 待办',
      fromEmail: '',
      netease: { host: 'smtp.163.com', port: 465, secure: true, user: '', pass: '' },
      microsoft: { host: 'smtp.office365.com', port: 587, secure: false, user: '', pass: '' },
      resend: { apiKey: '' },
    },
    registration: {
      enabled: true,
      requireEmailVerify: true,
      requireAdminApproval: false,
    },
  };
}

function deepMergeSettings(base: AppSettings, incoming: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...incoming,
    ai: { ...base.ai, ...(incoming.ai || {}) },
    sync: { ...base.sync, ...(incoming.sync || {}) },
    categories: incoming.categories || base.categories,
    apiConfig: { ...base.apiConfig, ...(incoming.apiConfig || {}) },
    mail: {
      ...base.mail,
      ...(incoming.mail || {}),
      netease: { ...base.mail.netease, ...(incoming.mail?.netease || {}) },
      microsoft: { ...base.mail.microsoft, ...(incoming.mail?.microsoft || {}) },
      resend: { ...base.mail.resend, ...(incoming.mail?.resend || {}) },
    },
    registration: { ...base.registration, ...(incoming.registration || {}) },
  };
}

function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    roleName: row.role_name,
    avatar: row.avatar,
    plan: row.plan,
    status: row.status,
    emailVerified: Boolean(row.email_verified),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    devicesCount: Number(row.devices_count || 0),
  };
}

const USER_SELECT = `SELECT u.*, (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id) AS devices_count FROM users u`;

function mapTodo(row: any): TodoRecord {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags || '[]');
    tags = Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string').slice(0, 20) : [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    completed: Boolean(row.completed),
    priority: PRIORITIES.includes(row.priority) ? row.priority : 'medium',
    category: row.category || '工作',
    tags,
    dueDate: row.due_date || null,
    dueTime: row.due_time || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

function mapDevice(row: any): DeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    platform: PLATFORMS.includes(row.platform) ? row.platform : 'web',
    clientVersion: row.client_version,
    ip: row.ip,
    lastActive: row.last_active,
    status: row.status,
    syncInterval: row.sync_interval,
  };
}

function insertUserRow(user: UserRecord) {
  getDb().prepare(`
    INSERT INTO users (id, username, email, password_hash, role, role_name, avatar, plan, status, email_verified, must_change_password, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.email,
    user.passwordHash,
    user.role,
    user.roleName,
    user.avatar,
    user.plan,
    user.status,
    user.emailVerified ? 1 : 0,
    user.mustChangePassword ? 1 : 0,
    user.createdAt
  );
}

function insertTodoRow(todo: TodoRecord) {
  getDb().prepare(`
    INSERT INTO todos (id, user_id, title, description, completed, priority, category, tags, due_date, due_time, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    todo.id,
    todo.userId,
    todo.title,
    todo.description || '',
    todo.completed ? 1 : 0,
    todo.priority,
    todo.category,
    JSON.stringify(todo.tags || []),
    todo.dueDate,
    todo.dueTime || null,
    todo.createdAt,
    todo.updatedAt,
    todo.completedAt || null
  );
}

function migrateJsonIfNeeded() {
  const jsonFile = path.join(dataDir(), 'app.json');
  const count = Number((getDb().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c);
  if (count > 0 || !fs.existsSync(jsonFile)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    tx(() => {
      if (parsed.settings) saveSettings(deepMergeSettings(defaultSettings(), parsed.settings));
      for (const user of parsed.users || []) {
        const mustChange = user.passwordHash ? bcrypt.compareSync('Admin@123456', user.passwordHash) : false;
        insertUserRow({
          ...user,
          email: String(user.email || '').toLowerCase(),
          emailVerified: Boolean(user.emailVerified),
          mustChangePassword: mustChange || Boolean(user.mustChangePassword),
          devicesCount: 0,
        });
      }
      for (const todo of parsed.todos || []) insertTodoRow(todo);
      for (const device of parsed.devices || []) {
        getDb().prepare(`
          INSERT INTO devices (id, user_id, name, platform, client_version, ip, last_active, status, sync_interval)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(device.id, device.userId, device.name, device.platform, device.clientVersion, device.ip, device.lastActive, device.status, device.syncInterval);
      }
    });
    fs.renameSync(jsonFile, `${jsonFile}.migrated`);
    console.log('[AI Todo] 已把 data/app.json 迁入 SQLite，原文件改名为 app.json.migrated');
  } catch (err) {
    console.error('[AI Todo] 迁移 JSON 失败，将使用空库', err);
  }
}

function ensureAdmin() {
  const count = Number((getDb().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c);
  if (count > 0) {
    const admins = listUsers().filter((u) => u.role === 'admin' && u.mustChangePassword);
    if (admins.length) {
      console.log('[AI Todo] 存在仍使用初始密码的管理员，登录后必须修改密码');
    }
    return;
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@aitodo.local').toLowerCase();
  let password = process.env.ADMIN_PASSWORD || '';
  const weak = !password || password === 'Admin@123456' || password.length < 8;
  let wroteFile = false;
  if (weak) {
    password = `A${crypto.randomBytes(9).toString('base64url')}7`;
    const file = path.join(dataDir(), 'bootstrap-admin.txt');
    fs.writeFileSync(file, `email=${email}\npassword=${password}\n请登录后立即修改密码，然后删除本文件。\n`, { encoding: 'utf8' });
    wroteFile = true;
  }

  insertUserRow({
    id: 'usr-admin-01',
    username: 'admin',
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'admin',
    roleName: '系统管理员',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin',
    plan: 'Admin',
    status: 'active',
    emailVerified: true,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    devicesCount: 0,
  });

  if (wroteFile) {
    console.log('[AI Todo] 已创建管理员。初始密码写入 data/bootstrap-admin.txt，控制台不显示密码');
  } else {
    console.log(`[AI Todo] 已用环境变量创建管理员 ${email}，登录后请修改密码`);
  }
}

export function initStore() {
  getDb();
  if (!getDb().prepare('SELECT json FROM settings WHERE id = 1').get()) {
    saveSettings(defaultSettings());
  }
  migrateJsonIfNeeded();
  ensureAdmin();
  getDb().prepare('DELETE FROM sessions WHERE expires_at < ? OR revoked = 1').run(Date.now() - 86400000);
}

export function getSettings(): AppSettings {
  const row = getDb().prepare('SELECT json FROM settings WHERE id = 1').get() as { json: string } | undefined;
  if (!row) return defaultSettings();
  try {
    return deepMergeSettings(defaultSettings(), JSON.parse(row.json));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings) {
  const json = JSON.stringify(settings);
  getDb().prepare(`
    INSERT INTO settings (id, json) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET json = excluded.json
  `).run(json);
}

export function listUsers(): UserRecord[] {
  return (getDb().prepare(`${USER_SELECT} ORDER BY created_at ASC`).all() as any[]).map(mapUser);
}

export function findUserById(id: string) {
  const row = getDb().prepare(`${USER_SELECT} WHERE u.id = ?`).get(id);
  return row ? mapUser(row) : undefined;
}

export function findUserByEmailOrName(value: string) {
  const key = value.trim().toLowerCase();
  const row = getDb().prepare(`${USER_SELECT} WHERE lower(u.email) = ? OR lower(u.username) = ?`).get(key, key);
  return row ? mapUser(row) : undefined;
}

export function emailExists(email: string) {
  return Boolean(getDb().prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(email.toLowerCase()));
}

export function usernameExists(username: string) {
  return Boolean(getDb().prepare('SELECT 1 FROM users WHERE lower(username) = ?').get(username.toLowerCase()));
}

export function insertUser(user: UserRecord) {
  insertUserRow(user);
  return findUserById(user.id)!;
}

export function updateUser(id: string, patch: Partial<UserRecord>) {
  const current = findUserById(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, id: current.id };
  getDb().prepare(`
    UPDATE users SET username=?, email=?, password_hash=?, role=?, role_name=?, avatar=?, plan=?, status=?, email_verified=?, must_change_password=?
    WHERE id=?
  `).run(
    next.username,
    next.email,
    next.passwordHash,
    next.role,
    next.roleName,
    next.avatar,
    next.plan,
    next.status,
    next.emailVerified ? 1 : 0,
    next.mustChangePassword ? 1 : 0,
    id
  );
  return findUserById(id);
}

export function countActiveAdmins(exceptId?: string) {
  if (exceptId) {
    const row = getDb().prepare(`SELECT COUNT(*) AS c FROM users WHERE role='admin' AND status='active' AND id != ?`).get(exceptId) as { c: number };
    return Number(row.c);
  }
  const row = getDb().prepare(`SELECT COUNT(*) AS c FROM users WHERE role='admin' AND status='active'`).get() as { c: number };
  return Number(row.c);
}

export function deleteUser(id: string) {
  const existed = findUserById(id);
  if (!existed) return false;
  tx(() => {
    const db = getDb();
    db.prepare('DELETE FROM todos WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM devices WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  return true;
}

export function listTodosByUser(userId: string) {
  return (getDb().prepare('SELECT * FROM todos WHERE user_id = ?').all(userId) as any[]).map(mapTodo);
}

export function todoStats() {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed
    FROM todos
  `).get() as { total: number; completed: number | null };
  return { total: Number(row.total), completed: Number(row.completed || 0) };
}

export function userTodoCounts(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const rows = listTodosByUser(userId);
  return {
    total: rows.length,
    activeCount: rows.filter((t) => !t.completed).length,
    completedCount: rows.filter((t) => t.completed).length,
    todayCount: rows.filter((t) => t.dueDate === today && !t.completed).length,
    upcomingCount: rows.filter((t) => t.dueDate && t.dueDate > today && !t.completed).length,
  };
}

export function queryTodos(userId: string, query: {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  let result = listTodosByUser(userId);
  const today = new Date().toISOString().split('T')[0];
  if (query.status === 'active') result = result.filter((t) => !t.completed);
  else if (query.status === 'completed') result = result.filter((t) => t.completed);
  else if (query.status === 'today') result = result.filter((t) => t.dueDate === today);
  else if (query.status === 'upcoming') result = result.filter((t) => Boolean(t.dueDate && t.dueDate > today && !t.completed));
  if (query.category && query.category !== 'all') result = result.filter((t) => t.category === query.category);
  if (query.priority && query.priority !== 'all') result = result.filter((t) => t.priority === query.priority);
  if (query.search) {
    const q = query.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }
  const weight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  const sort = query.sort || 'createdAt';
  result.sort((a, b) => {
    if (sort === 'priority') return (weight[b.priority] || 0) - (weight[a.priority] || 0);
    if (sort === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sort === 'title') return a.title.localeCompare(b.title, 'zh-CN');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 50));
  const page = Math.max(1, query.page || 1);
  const start = (page - 1) * pageSize;
  return {
    data: result.slice(start, start + pageSize),
    filteredTotal: result.length,
    page,
    pageSize,
    ...userTodoCounts(userId),
  };
}

export function findTodo(id: string, userId: string) {
  const row = getDb().prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId);
  return row ? mapTodo(row) : undefined;
}

export function insertTodo(todo: TodoRecord) {
  insertTodoRow(todo);
  return findTodo(todo.id, todo.userId)!;
}

export function updateTodo(id: string, userId: string, patch: Partial<TodoRecord>) {
  const current = findTodo(id, userId);
  if (!current) return undefined;
  const next: TodoRecord = {
    ...current,
    ...patch,
    id: current.id,
    userId,
    tags: Array.isArray(patch.tags) ? patch.tags.filter((t) => typeof t === 'string').slice(0, 20) : current.tags,
    updatedAt: new Date().toISOString(),
  };
  getDb().prepare(`
    UPDATE todos SET title=?, description=?, completed=?, priority=?, category=?, tags=?, due_date=?, due_time=?, updated_at=?, completed_at=?
    WHERE id=? AND user_id=?
  `).run(
    next.title,
    next.description || '',
    next.completed ? 1 : 0,
    next.priority,
    next.category,
    JSON.stringify(next.tags),
    next.dueDate,
    next.dueTime || null,
    next.updatedAt,
    next.completedAt || null,
    id,
    userId
  );
  return findTodo(id, userId);
}

export function deleteTodo(id: string, userId: string) {
  const info = getDb().prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
}

export function deleteTodosByIds(userId: string, ids: string[]) {
  const removed: TodoRecord[] = [];
  tx(() => {
    for (const id of ids) {
      const todo = findTodo(id, userId);
      if (!todo) continue;
      deleteTodo(id, userId);
      removed.push(todo);
    }
  });
  return removed;
}

export function clearCompletedTodos(userId: string) {
  const cleared = listTodosByUser(userId).filter((t) => t.completed);
  getDb().prepare('DELETE FROM todos WHERE user_id = ? AND completed = 1').run(userId);
  return cleared;
}

export function importTodos(userId: string, items: TodoRecord[], mode: 'merge' | 'overwrite') {
  tx(() => {
    if (mode === 'overwrite') {
      getDb().prepare('DELETE FROM todos WHERE user_id = ?').run(userId);
    }
    for (const item of items) {
      if (mode !== 'overwrite' && findTodo(item.id, userId)) continue;
      const existing = getDb().prepare('SELECT id FROM todos WHERE id = ?').get(item.id);
      if (existing) continue;
      insertTodoRow({ ...item, userId });
    }
  });
}

export function listDevices(userId?: string) {
  const rows = userId
    ? getDb().prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY last_active DESC').all(userId)
    : getDb().prepare('SELECT * FROM devices').all();
  return (rows as any[]).map(mapDevice);
}

export function countOnlineDevices() {
  const row = getDb().prepare(`SELECT COUNT(*) AS c FROM devices WHERE status = 'online'`).get() as { c: number };
  return Number(row.c);
}

export function upsertDevice(params: {
  userId: string;
  name: string;
  platform: ClientPlatform;
  clientVersion?: string;
  ip?: string;
}) {
  const existing = getDb().prepare(
    'SELECT * FROM devices WHERE user_id = ? AND name = ? AND platform = ?'
  ).get(params.userId, params.name, params.platform) as any;
  const now = new Date().toISOString();
  if (existing) {
    getDb().prepare(`
      UPDATE devices SET last_active=?, status='online', ip=?, client_version=? WHERE id=?
    `).run(now, params.ip || existing.ip, params.clientVersion || existing.client_version, existing.id);
    return mapDevice({ ...existing, last_active: now, status: 'online', ip: params.ip || existing.ip });
  }
  const count = Number((getDb().prepare('SELECT COUNT(*) AS c FROM devices WHERE user_id = ?').get(params.userId) as { c: number }).c);
  if (count >= MAX_DEVICES) {
    const oldest = getDb().prepare('SELECT id FROM devices WHERE user_id = ? ORDER BY last_active ASC LIMIT 1').get(params.userId) as { id: string };
    getDb().prepare('DELETE FROM sessions WHERE device_id = ?').run(oldest.id);
    getDb().prepare('DELETE FROM devices WHERE id = ?').run(oldest.id);
  }
  const id = `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const device: DeviceRecord = {
    id,
    userId: params.userId,
    name: params.name,
    platform: params.platform,
    clientVersion: params.clientVersion || '1.0.0',
    ip: params.ip || 'unknown',
    lastActive: now,
    status: 'online',
    syncInterval: '登录同步',
  };
  getDb().prepare(`
    INSERT INTO devices (id, user_id, name, platform, client_version, ip, last_active, status, sync_interval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(device.id, device.userId, device.name, device.platform, device.clientVersion, device.ip, device.lastActive, device.status, device.syncInterval);
  return device;
}

export function deleteDevice(id: string, userId: string) {
  const info = getDb().prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').run(id, userId);
  if (info.changes > 0) {
    getDb().prepare('DELETE FROM sessions WHERE device_id = ?').run(id);
    return true;
  }
  return false;
}

export function createSession(jti: string, userId: string, deviceId: string | null, expiresAt: number) {
  getDb().prepare('INSERT INTO sessions (jti, user_id, device_id, expires_at, revoked) VALUES (?, ?, ?, ?, 0)').run(jti, userId, deviceId, expiresAt);
}

export function getSession(jti: string) {
  return getDb().prepare('SELECT * FROM sessions WHERE jti = ?').get(jti) as
    | { jti: string; user_id: string; device_id: string | null; expires_at: number; revoked: number }
    | undefined;
}

export function revokeSession(jti: string) {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE jti = ?').run(jti);
}

export function revokeUserSessions(userId: string) {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(userId);
}

export interface VerifyCodeRow {
  email: string;
  codeHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

export function getVerifyCode(email: string): VerifyCodeRow | undefined {
  const row = getDb().prepare('SELECT * FROM verify_codes WHERE email = ?').get(email) as any;
  if (!row) return undefined;
  return {
    email: row.email,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    lastSentAt: row.last_sent_at,
    attempts: row.attempts,
  };
}

export function saveVerifyCode(email: string, codeHash: string, expiresAt: number, lastSentAt: number) {
  getDb().prepare(`
    INSERT INTO verify_codes (email, code_hash, expires_at, last_sent_at, attempts)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, last_sent_at=excluded.last_sent_at, attempts=0
  `).run(email, codeHash, expiresAt, lastSentAt);
}

export function bumpVerifyAttempt(email: string) {
  getDb().prepare('UPDATE verify_codes SET attempts = attempts + 1 WHERE email = ?').run(email);
}

export function deleteVerifyCode(email: string) {
  getDb().prepare('DELETE FROM verify_codes WHERE email = ?').run(email);
}

export function assertRole(role: string): role is UserRole {
  return role === 'admin' || role === 'manager' || role === 'member' || role === 'guest';
}

export function assertStatus(status: string): status is UserStatus {
  return status === 'active' || status === 'pending' || status === 'disabled';
}

initStore();
