import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { dataDir } from './db.js';
import {
  createSession,
  deleteVerifyCode,
  findUserByEmailOrName as findUser,
  findUserById,
  getSession,
  getVerifyCode,
  bumpVerifyAttempt,
  revokeSession,
  revokeUserSessions,
  saveVerifyCode,
  upsertDevice,
} from './store.js';
import { ClientPlatform, PublicUser, UserRecord, UserRole } from './types.js';

const TOKEN_MS = 14 * 24 * 60 * 60 * 1000;
export const COOKIE_NAME = 'aitodo_token';
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function loadJwtSecret() {
  const fromEnv = process.env.JWT_SECRET || '';
  if (fromEnv.length >= 24 && !fromEnv.includes('change-me')) return fromEnv;
  const file = path.join(dataDir(), 'jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { encoding: 'utf8' });
  console.log('[AI Todo] 已生成 JWT 密钥到 data/jwt-secret，未使用硬编码默认值');
  return secret;
}

const JWT_SECRET = loadJwtSecret();

export function clientIp(req: Request) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim().slice(0, 64);
    }
  }
  return (req.socket.remoteAddress || 'unknown').slice(0, 64);
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    roleName: user.roleName,
    avatar: user.avatar,
    plan: user.plan,
    status: user.status,
    emailVerified: user.emailVerified,
    mustChangePassword: Boolean(user.mustChangePassword),
    devicesCount: user.devicesCount,
    createdAt: user.createdAt,
  };
}

export function assertPassword(password: string) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new Error('密码需为 8 到 72 位');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('密码需同时包含字母和数字');
  }
}

export function hashCode(email: string, code: string) {
  return crypto.createHash('sha256').update(`${JWT_SECRET}:${email}:${code}`).digest('hex');
}

export function codesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash || DUMMY_HASH);
}

export function signToken(user: UserRecord, deviceId: string | null) {
  const jti = crypto.randomUUID();
  const exp = Date.now() + TOKEN_MS;
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email, username: user.username, jti },
    JWT_SECRET,
    { expiresIn: '14d', algorithm: 'HS256' }
  );
  createSession(jti, user.id, deviceId, exp);
  return token;
}

export function setAuthCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(TOKEN_MS / 1000)}; SameSite=Lax${secure}`
  );
}

export function clearAuthCookie(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function tokenFromRequest(req: Request) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return readCookie(req, COOKIE_NAME);
}

const CHANGE_PASSWORD_OK = new Set(['/api/auth/change-password', '/api/auth/logout', '/api/auth/me']);

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ success: false, error: '请先登录' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { sub: string; jti?: string };
    if (!payload.jti) return res.status(401).json({ success: false, error: '登录已失效，请重新登录' });
    const session = getSession(payload.jti);
    if (!session || session.revoked || session.expires_at < Date.now()) {
      return res.status(401).json({ success: false, error: '登录已失效，请重新登录' });
    }
    const user = findUserById(payload.sub);
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ success: false, error: '账号不可用' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ success: false, error: '账号待管理员审核' });
    }
    const url = req.originalUrl.split('?')[0];
    if (user.mustChangePassword && !CHANGE_PASSWORD_OK.has(url)) {
      return res.status(403).json({ success: false, error: '请先修改初始密码', code: 'MUST_CHANGE_PASSWORD' });
    }
    (req as Request & { user: { id: string; role: UserRole; email: string; username: string }; jti: string }).user = {
      id: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
    };
    (req as Request & { jti: string }).jti = payload.jti;
    next();
  } catch {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: { role: UserRole } }).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '需要管理员权限' });
  }
  next();
}

export function getAuthUser(req: Request) {
  return (req as Request & { user: { id: string; role: UserRole; email: string; username: string } }).user;
}

export function getJti(req: Request) {
  return (req as Request & { jti?: string }).jti || '';
}

export function findUserByEmailOrName(value: string) {
  return findUser(value);
}

export { findUserById, revokeUserSessions };

export function createVerifyCode(email: string) {
  const now = Date.now();
  const existing = getVerifyCode(email);
  if (existing && now - existing.lastSentAt < 60_000) {
    const wait = Math.ceil((60_000 - (now - existing.lastSentAt)) / 1000);
    throw new Error(`请 ${wait} 秒后再发送验证码`);
  }
  const code = String(crypto.randomInt(100000, 999999));
  saveVerifyCode(email, hashCode(email, code), now + 10 * 60_000, now);
  return code;
}

export function consumeVerifyCode(email: string, code: string) {
  const rec = getVerifyCode(email);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt || rec.attempts >= 5) {
    deleteVerifyCode(email);
    return false;
  }
  if (!codesMatch(rec.codeHash, hashCode(email, code.trim()))) {
    bumpVerifyAttempt(email);
    const again = getVerifyCode(email);
    if (again && again.attempts >= 5) deleteVerifyCode(email);
    return false;
  }
  deleteVerifyCode(email);
  return true;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

export function normalizePlatform(value: unknown): ClientPlatform {
  if (value === 'desktop-rust' || value === 'mobile-uniapp' || value === 'web') return value;
  return 'web';
}

export function normalizeDeviceName(value: unknown, platform: ClientPlatform) {
  const fallback = platform === 'desktop-rust' ? 'Rust 桌面端' : platform === 'mobile-uniapp' ? 'UniApp 移动端' : 'Web 浏览器';
  const name = String(value || fallback).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 64);
  return name || fallback;
}

export function touchDevice(params: {
  userId: string;
  name?: string;
  platform?: unknown;
  clientVersion?: string;
  ip?: string;
}) {
  const platform = normalizePlatform(params.platform);
  return upsertDevice({
    userId: params.userId,
    platform,
    name: normalizeDeviceName(params.name, platform),
    clientVersion: String(params.clientVersion || '1.0.0').slice(0, 32),
    ip: params.ip,
  });
}

export function logoutCurrent(req: Request) {
  const jti = getJti(req);
  if (jti) revokeSession(jti);
}

export function roleNameOf(role: UserRole) {
  const map = {
    admin: '系统管理员',
    manager: '管理员协助',
    member: '普通成员',
    guest: '访客',
  };
  return map[role];
}

export function sortTodos<T extends { completed: boolean; priority: string; createdAt: string }>(list: T[]) {
  const weight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  return [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const p = (weight[b.priority] || 0) - (weight[a.priority] || 0);
    if (p !== 0) return p;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
