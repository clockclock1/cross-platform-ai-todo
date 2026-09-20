import { Router } from 'express';
import { adminRequired, authRequired, getAuthUser } from '../auth.js';
import { mergeMailSecrets, publicMailConfig, sendMail } from '../mail.js';
import { allowRequest } from '../rate-limit.js';
import { importUserTodos } from './todos.js';
import {
  countOnlineDevices,
  deleteDevice,
  getSettings,
  listDevices,
  listTodosByUser,
  listUsers,
  saveSettings,
  todoStats,
} from '../store.js';
import { AppSettings, MailChannel } from '../types.js';

const router = Router();
router.use(authRequired);

const CHANNELS: MailChannel[] = ['netease', 'microsoft', 'resend'];

function settingsForExport(settings: AppSettings): AppSettings {
  return {
    ...settings,
    mail: {
      ...publicMailConfig(settings.mail),
      netease: { ...settings.mail.netease, pass: '' },
      microsoft: { ...settings.mail.microsoft, pass: '' },
      resend: { apiKey: '' },
    },
  };
}

router.get('/settings', adminRequired, (_req, res) => {
  const settings = getSettings();
  const stats = todoStats();
  res.json({
    success: true,
    data: { ...settings, mail: publicMailConfig(settings.mail) },
    stats: {
      totalTodos: stats.total,
      completedTodos: stats.completed,
      activeDevices: countOnlineDevices(),
      totalUsers: listUsers().length,
    },
  });
});

router.put('/settings', adminRequired, (req, res) => {
  const current = getSettings();
  const { ai, sync, categories, apiConfig, mail, registration } = req.body || {};
  const next = { ...current };
  if (ai && typeof ai === 'object') {
    next.ai = {
      ...current.ai,
      ...ai,
      model: String(ai.model || current.ai.model).slice(0, 80),
      temperature: Math.min(1, Math.max(0, Number(ai.temperature ?? current.ai.temperature) || 0)),
      customPrompt: String(ai.customPrompt ?? current.ai.customPrompt).slice(0, 2000),
    };
  }
  if (sync && typeof sync === 'object') next.sync = { ...current.sync, ...sync };
  if (Array.isArray(categories)) next.categories = categories.slice(0, 50);
  if (apiConfig && typeof apiConfig === 'object') {
    next.apiConfig = {
      ...current.apiConfig,
      webhookUrl: String(apiConfig.webhookUrl ?? current.apiConfig.webhookUrl).slice(0, 300),
      enablePublicApi: Boolean(apiConfig.enablePublicApi ?? current.apiConfig.enablePublicApi),
      corsOrigins: String(apiConfig.corsOrigins ?? current.apiConfig.corsOrigins).slice(0, 500),
    };
  }
  if (mail && typeof mail === 'object') {
    if (mail.channel && !CHANNELS.includes(mail.channel)) {
      return res.status(400).json({ success: false, error: '发件渠道不合法' });
    }
    next.mail = mergeMailSecrets(current.mail, mail);
  }
  if (registration && typeof registration === 'object') {
    next.registration = {
      enabled: Boolean(registration.enabled),
      requireEmailVerify: Boolean(registration.requireEmailVerify),
      requireAdminApproval: Boolean(registration.requireAdminApproval),
    };
  }
  saveSettings(next);
  res.json({ success: true, data: { ...getSettings(), mail: publicMailConfig(getSettings().mail) } });
});

router.post('/mail/test', adminRequired, async (req, res) => {
  try {
    const auth = getAuthUser(req);
    if (!allowRequest(`mailtest:${auth.id}`, 5, 60 * 60_000)) {
      return res.status(429).json({ success: false, error: '测试邮件发送过于频繁' });
    }
    const to = String(req.body?.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ success: false, error: '请输入有效的测试收件邮箱' });
    }
    await sendMail(getSettings().mail, to, 'AI 待办 SMTP 测试', '这是一封来自 AI 待办系统的测试邮件，说明当前发件渠道配置正常。');
    res.json({ success: true, message: '测试邮件已发送' });
  } catch {
    res.status(400).json({ success: false, error: '发送失败，请检查发件配置' });
  }
});

router.get('/devices', (req, res) => {
  const auth = getAuthUser(req);
  res.json({ success: true, data: listDevices(auth.id) });
});

router.delete('/devices/:id', (req, res) => {
  const auth = getAuthUser(req);
  if (!deleteDevice(req.params.id, auth.id)) {
    return res.status(404).json({ success: false, error: '设备不存在' });
  }
  res.json({ success: true, message: '设备已注销，该设备上的登录已失效' });
});

router.get('/backup/export', adminRequired, (req, res) => {
  const auth = getAuthUser(req);
  const bundle = {
    app: 'Cross-Platform AI Todo',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    todos: listTodosByUser(auth.id),
    settings: settingsForExport(getSettings()),
    devices: listDevices(auth.id),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=todo-backup-${Date.now()}.json`);
  res.json(bundle);
});

router.post('/backup/import', adminRequired, (req, res) => {
  const auth = getAuthUser(req);
  const imported = req.body?.todos;
  if (!Array.isArray(imported)) return res.status(400).json({ success: false, error: '导入数据格式无效' });
  const mode = req.body?.mode === 'overwrite' ? 'overwrite' : 'merge';
  const count = importUserTodos(auth.id, imported, mode);
  res.json({ success: true, count, message: '导入成功' });
});

router.get('/registration', (_req, res) => {
  res.json({ success: true, data: getSettings().registration });
});

export default router;
