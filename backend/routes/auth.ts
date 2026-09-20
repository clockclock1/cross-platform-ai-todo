import { Router } from 'express';
import {
  adminRequired,
  assertPassword,
  authRequired,
  clearAuthCookie,
  clientIp,
  consumeVerifyCode,
  createVerifyCode,
  findUserByEmailOrName,
  findUserById,
  getAuthUser,
  hashPassword,
  logoutCurrent,
  newId,
  roleNameOf,
  setAuthCookie,
  signToken,
  toPublicUser,
  touchDevice,
  verifyPassword,
} from '../auth.js';
import { allowRequest } from '../rate-limit.js';
import { sendMail, sendVerificationCode } from '../mail.js';
import {
  assertRole,
  assertStatus,
  countActiveAdmins,
  deleteUser,
  emailExists,
  getSettings,
  insertUser,
  listUsers,
  revokeUserSessions,
  updateUser,
  usernameExists,
} from '../store.js';
import { UserRole, UserStatus } from '../types.js';

const router = Router();

function tooMany(res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  return res.status(429).json({ success: false, error: '请求过于频繁，请稍后再试' });
}

function issueLogin(
  res: import('express').Response,
  user: ReturnType<typeof findUserById>,
  platform: unknown,
  deviceName: unknown,
  clientVersion: unknown,
  ip: string,
  asCookie: boolean,
  statusCode = 200
) {
  if (!user) return;
  const device = touchDevice({
    userId: user.id,
    platform,
    name: typeof deviceName === 'string' ? deviceName : undefined,
    clientVersion: typeof clientVersion === 'string' ? clientVersion : undefined,
    ip,
  });
  const fresh = findUserById(user.id)!;
  const token = signToken(fresh, device.id);
  if (asCookie) setAuthCookie(res, token);
  res.status(statusCode).json({
    success: true,
    user: toPublicUser(fresh),
    token: asCookie ? undefined : token,
  });
}

router.post('/send-code', async (req, res) => {
  try {
    const ip = clientIp(req);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!allowRequest(`send:ip:${ip}`, 20, 60 * 60_000) || (email && !allowRequest(`send:email:${email}`, 3, 60 * 60_000))) {
      return tooMany(res);
    }
    const generic = { success: true, message: '若该邮箱可以注册，验证码将发送到邮箱' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json(generic);
    }
    const reg = getSettings().registration;
    const mail = getSettings().mail;
    if (!reg.enabled || emailExists(email)) return res.json(generic);
    if (reg.requireEmailVerify && !mail.enabled) {
      return res.status(503).json({ success: false, error: '邮件服务未配置，暂时无法发送验证码' });
    }
    const code = createVerifyCode(email);
    if (reg.requireEmailVerify) await sendVerificationCode(mail, email, code);
    res.json(generic);
  } catch (err: any) {
    const message = String(err.message || '');
    if (message.includes('秒后再发送')) return res.status(429).json({ success: false, error: message });
    res.status(400).json({ success: false, error: '验证码发送失败，请稍后再试' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const ip = clientIp(req);
    if (!allowRequest(`reg:ip:${ip}`, 10, 60 * 60_000)) return tooMany(res);
    const { username, email, password, code } = req.body || {};
    const reg = getSettings().registration;
    if (!reg.enabled) return res.status(403).json({ success: false, error: '当前已关闭注册' });
    const name = String(username || '').trim().slice(0, 32);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password) {
      return res.status(400).json({ success: false, error: '请填写有效的用户名、邮箱和密码' });
    }
    try {
      assertPassword(password);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (emailExists(normalizedEmail) || usernameExists(name)) {
      return res.status(400).json({ success: false, error: '注册信息不合法或已被占用' });
    }
    if (reg.requireEmailVerify && !consumeVerifyCode(normalizedEmail, String(code || ''))) {
      return res.status(400).json({ success: false, error: '验证码无效或已过期' });
    }
    const user = insertUser({
      id: newId('usr'),
      username: name,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: 'member',
      roleName: roleNameOf('member'),
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      plan: 'Standard',
      status: reg.requireAdminApproval ? 'pending' : 'active',
      emailVerified: reg.requireEmailVerify,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      devicesCount: 0,
    });
    if (user.status === 'pending') {
      return res.status(201).json({ success: true, pending: true, message: '注册成功，请等待管理员审核', user: toPublicUser(user) });
    }
    issueLogin(res, user, 'web', undefined, undefined, ip, true, 201);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const ip = clientIp(req);
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!allowRequest(`login:ip:${ip}`, 30, 15 * 60_000) || !allowRequest(`login:${ip}:${email.toLowerCase()}`, 8, 15 * 60_000)) {
      return tooMany(res);
    }
    if (!email || !password) return res.status(400).json({ success: false, error: '请输入邮箱和密码' });
    const user = findUserByEmailOrName(email);
    const ok = await verifyPassword(password, user?.passwordHash || '');
    if (!user || !ok) return res.status(401).json({ success: false, error: '邮箱或密码错误' });
    if (user.status === 'disabled') return res.status(403).json({ success: false, error: '账号已被禁用' });
    if (user.status === 'pending') return res.status(403).json({ success: false, error: '账号待管理员审核' });
    const platform = req.body?.platform;
    const asCookie = !platform || platform === 'web';
    issueLogin(res, user, platform, req.body?.deviceName, req.body?.clientVersion, ip, asCookie);
  } catch {
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

router.post('/logout', authRequired, (req, res) => {
  logoutCurrent(req);
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get('/me', authRequired, (req, res) => {
  const auth = getAuthUser(req);
  const user = findUserById(auth.id);
  if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
  res.json({ success: true, user: toPublicUser(user) });
});

router.post('/change-password', authRequired, async (req, res) => {
  try {
    const auth = getAuthUser(req);
    const user = findUserById(auth.id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!(await verifyPassword(oldPassword, user.passwordHash))) {
      return res.status(400).json({ success: false, error: '原密码不正确' });
    }
    try {
      assertPassword(newPassword);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (oldPassword === newPassword) return res.status(400).json({ success: false, error: '新密码不能与原密码相同' });
    updateUser(user.id, { passwordHash: await hashPassword(newPassword), mustChangePassword: false });
    revokeUserSessions(user.id);
    const fresh = findUserById(user.id)!;
    const device = touchDevice({ userId: user.id, platform: 'web', ip: clientIp(req) });
    const token = signToken(fresh, device.id);
    setAuthCookie(res, token);
    res.json({ success: true, user: toPublicUser(fresh) });
  } catch {
    res.status(500).json({ success: false, error: '修改密码失败' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const ip = clientIp(req);
  if (!allowRequest(`forgot:${ip}`, 5, 60 * 60_000)) return tooMany(res);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const generic = { success: true, message: '若邮箱已注册且邮件服务可用，重置验证码将发送到邮箱' };
  const user = email ? findUserByEmailOrName(email) : undefined;
  const mail = getSettings().mail;
  if (!user || !mail.enabled) return res.json(generic);
  try {
    const code = createVerifyCode(user.email);
    await sendMail(mail, user.email, 'AI 待办重置密码', `你的重置验证码是 ${code}，10 分钟内有效。如果不是你本人操作，请忽略。`);
  } catch {
    /* 统一返回，避免暴露邮箱是否存在 */
  }
  res.json(generic);
});

router.post('/reset-password', async (req, res) => {
  const ip = clientIp(req);
  if (!allowRequest(`reset:${ip}`, 10, 60 * 60_000)) return tooMany(res);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '');
  const password = String(req.body?.password || '');
  const user = findUserByEmailOrName(email);
  if (!user || !consumeVerifyCode(user.email, code)) {
    return res.status(400).json({ success: false, error: '验证码无效或已过期' });
  }
  try {
    assertPassword(password);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
  updateUser(user.id, { passwordHash: await hashPassword(password), mustChangePassword: false });
  revokeUserSessions(user.id);
  res.json({ success: true, message: '密码已重置，请重新登录' });
});

router.post('/client-token', authRequired, (req, res) => {
  const auth = getAuthUser(req);
  const user = findUserById(auth.id);
  if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
  if (!allowRequest(`client-token:${user.id}`, 5, 60 * 60_000)) return tooMany(res);
  const device = touchDevice({
    userId: user.id,
    platform: req.body?.platform,
    name: req.body?.deviceName,
    clientVersion: req.body?.clientVersion,
    ip: clientIp(req),
  });
  const token = signToken(user, device.id);
  res.json({ success: true, token, deviceId: device.id });
});

router.get('/users', authRequired, adminRequired, (_req, res) => {
  res.json({ success: true, data: listUsers().map(toPublicUser) });
});

router.patch('/users/:id', authRequired, adminRequired, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
  const { role, status, plan } = req.body || {};
  if (role && !assertRole(role)) return res.status(400).json({ success: false, error: '角色不合法' });
  if (status && !assertStatus(status)) return res.status(400).json({ success: false, error: '状态不合法' });
  const nextRole = (role || user.role) as UserRole;
  const nextStatus = (status || user.status) as UserStatus;
  const losesAdmin = user.role === 'admin' && user.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active');
  if (losesAdmin && countActiveAdmins(user.id) === 0) {
    return res.status(400).json({ success: false, error: '至少保留一个可用管理员' });
  }
  const updated = updateUser(user.id, {
    role: nextRole,
    roleName: roleNameOf(nextRole),
    status: nextStatus,
    plan: plan ? String(plan).slice(0, 40) : user.plan,
  });
  if (nextStatus !== 'active') revokeUserSessions(user.id);
  res.json({ success: true, user: toPublicUser(updated!) });
});

router.delete('/users/:id', authRequired, adminRequired, (req, res) => {
  const auth = getAuthUser(req);
  if (auth.id === req.params.id) return res.status(400).json({ success: false, error: '不能删除当前登录账号' });
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
  if (user.role === 'admin' && user.status === 'active' && countActiveAdmins(user.id) === 0) {
    return res.status(400).json({ success: false, error: '至少保留一个可用管理员' });
  }
  deleteUser(user.id);
  res.json({ success: true, message: '用户已删除' });
});

export default router;
