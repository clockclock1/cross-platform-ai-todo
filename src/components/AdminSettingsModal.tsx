import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Cpu,
  Smartphone,
  Monitor,
  Laptop,
  Tag,
  Database,
  Key,
  Bell,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  Upload,
  AlertTriangle,
  Send,
  Radio,
  SlidersHorizontal,
  FolderOpen,
  Sparkles,
  ShieldCheck,
  Terminal,
  Activity,
  Mail,
  Users,
  Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { AdminSettings, ConnectedDevice, CategoryItem, TodoItem, User } from '../types';
import { apiFetch } from '../lib/api';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: TodoItem[];
  onRefreshTodos: () => void;
  categories: string[];
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  todos,
  onRefreshTodos,
  categories,
}) => {
  const { theme } = useTheme();
  const { currentUser, users, refreshUsers, updateUserAdmin, deleteUserAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'devices' | 'ai' | 'categories' | 'backup' | 'api' | 'preferences' | 'users' | 'mail' | 'registration'>('devices');

  // Settings State
  const [settings, setSettings] = useState<AdminSettings>({
    ai: {
      model: 'gemini-3.7-flash',
      temperature: 0.2,
      autoCategorize: true,
      defaultPriority: 'medium',
      customPrompt: '作为专业的跨平台待办助手，请保持精炼客观，准确解析截止日期和重要级别。',
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
      { id: 'cat-6', name: '测试', color: '#64748b', icon: 'FlaskConical', isSystem: false },
      { id: 'cat-7', name: '财务', color: '#06b6d4', icon: 'DollarSign', isSystem: false },
    ],
    apiConfig: {
      webhookUrl: '',
      enablePublicApi: true,
      corsOrigins: '*',
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
  });

  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [importJsonText, setImportJsonText] = useState('');
  const [testMailTo, setTestMailTo] = useState('');
  const [mailNotice, setMailNotice] = useState('');
  const [importNotice, setImportNotice] = useState('');

  // Fetch settings & devices on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchAdminData = async () => {
      try {
        const [setJson, devJson] = await Promise.all([
          apiFetch<{ success: boolean; data: AdminSettings }>('/api/settings'),
          apiFetch<{ success: boolean; data: ConnectedDevice[] }>('/api/devices'),
        ]);
        if (setJson.success && setJson.data) setSettings(setJson.data);
        if (devJson.success && Array.isArray(devJson.data)) setDevices(devJson.data);
        await refreshUsers();
      } catch (err) {
        console.warn('Failed to load admin settings from backend, using defaults');
      }
    };

    fetchAdminData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      onRefreshTodos();
    } catch (err) {
      setSaveStatus('idle');
    }
  };

  const handleRevokeDevice = async (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    try {
      await apiFetch(`/api/devices/${id}`, { method: 'DELETE' });
    } catch (err) {
      // rollback
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: CategoryItem = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
      icon: 'Tag',
      isSystem: false,
    };
    setSettings(prev => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
    }));
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      exportTime: new Date().toISOString(),
      todos,
      settings,
      devices,
    }, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `todo-backup-full-${Date.now()}.json`);
    dl.click();
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) return;
    try {
      const parsed = JSON.parse(importJsonText);
      const json = await apiFetch<{ success: boolean; count: number }>('/api/backup/import', {
        method: 'POST',
        body: JSON.stringify({ todos: parsed.todos || [], settings: parsed.settings, mode: 'merge' }),
      });
      if (json.success) {
        setImportNotice(`成功导入并合并 ${json.count} 项数据`);
        onRefreshTodos();
      }
    } catch (e: any) {
      setImportNotice('JSON 格式解析失败：' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className={`w-full max-w-4xl h-[90vh] max-h-[800px] border shadow-2xl flex flex-col overflow-hidden ${
          theme.isDark
            ? 'bg-[#10121a] border-[#31354a] text-slate-100'
            : 'bg-white border-slate-400 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-inherit bg-inherit shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-black flex items-center justify-center text-white text-xs font-mono font-bold">
              SYS
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase font-mono flex items-center gap-2">
                <span>跨平台多端系统管理后台</span>
                <span className="text-[10px] px-1.5 py-0.5 border font-mono bg-blue-950/60 text-blue-400 border-blue-800">
                  ADMIN CONSOLE v2.5
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                配置 Gemini AI 引擎参数、管理多端已连接设备 (Rust/UniApp) 与数据备份
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="admin-save-all-btn"
              type="button"
              onClick={handleSaveSettings}
              className={`px-3 py-1.5 border text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                saveStatus === 'saved'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : theme.isDark
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400'
                  : 'bg-black hover:bg-neutral-800 text-white border-black'
              }`}
            >
              {saveStatus === 'saving' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{saveStatus === 'saved' ? '已保存设置' : '保存全局配置'}</span>
            </button>

            <button
              id="close-admin-settings-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white border border-transparent hover:border-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Layout: Left Sidebar + Right Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Navigation Tabs */}
          <div className={`w-full md:w-56 border-b md:border-b-0 md:border-r border-inherit p-2 space-y-1 font-mono text-xs shrink-0 ${
            theme.isDark ? 'bg-[#0b0c12]' : 'bg-slate-50'
          }`}>
            {[
              { id: 'users', label: '账号管理', icon: Users, badge: `${users.length}` },
              { id: 'registration', label: '注册策略', icon: ShieldCheck, badge: settings.registration.enabled ? '开' : '关' },
              { id: 'mail', label: '邮件发件 SMTP', icon: Mail, badge: settings.mail.channel },
              { id: 'devices', label: '多端连接与设备', icon: Laptop, badge: `${devices.length}` },
              { id: 'ai', label: 'AI 模型与提示词', icon: Cpu, badge: 'Gemini' },
              { id: 'categories', label: '分类与标签体系', icon: Tag, badge: `${settings.categories.length}` },
              { id: 'backup', label: '数据备份与迁移', icon: Database, badge: `${todos.length}项` },
              { id: 'api', label: '开放 API & Webhook', icon: Key, badge: 'REST' },
              { id: 'preferences', label: '系统偏好与快捷键', icon: Sliders, badge: 'Hotkeys' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`admin-tab-${tab.id}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between p-2.5 text-left border transition-colors cursor-pointer ${
                    isActive
                      ? theme.isDark
                        ? 'bg-[#1a1d2b] border-cyan-500 text-cyan-400 font-bold'
                        : 'bg-white border-black text-black font-bold shadow-xs'
                      : theme.isDark
                      ? 'border-transparent text-slate-400 hover:bg-[#12141d] hover:text-slate-200'
                      : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 border ${
                    isActive
                      ? theme.isDark ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300' : 'border-black bg-black text-white'
                      : 'border-inherit text-slate-400'
                  }`}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}

            {/* Operator info card */}
            <div className={`mt-4 p-2.5 border text-[11px] font-mono ${
              theme.isDark ? 'bg-[#12141d] border-[#292c3f] text-slate-400' : 'bg-white border-slate-300 text-slate-600'
            }`}>
              <div className="text-[10px] uppercase text-slate-500">当前操作员:</div>
              <div className="font-bold text-slate-200 truncate mt-0.5">{currentUser?.username || 'Admin'}</div>
              <div className="text-[10px] text-emerald-500 font-bold mt-1">● RBAC 权限生效中</div>
            </div>
          </div>

          {/* Right Tab Content Panel */}
          <div className="flex-1 p-5 overflow-y-auto space-y-6">
            {activeTab === 'users' && (
              <div className="space-y-3">
                <h3 className="font-bold font-mono text-sm uppercase">账号管理 (USER MANAGEMENT)</h3>
                {users.map((u: User) => (
                  <div key={u.id} className={`p-3 border flex flex-wrap items-center justify-between gap-2 ${theme.isDark ? 'border-[#2b2e42]' : 'border-slate-300'}`}>
                    <div>
                      <div className="font-bold text-xs font-mono">{u.username} · {u.email}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.roleName} · {u.status} · {u.emailVerified ? '已验证' : '未验证'}</div>
                    </div>
                    <div className="flex gap-2 text-xs font-mono">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserAdmin(u.id, { role: e.target.value as User['role'] })}
                        className="px-2 py-1 border"
                      >
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="member">member</option>
                        <option value="guest">guest</option>
                      </select>
                      <select
                        value={u.status || 'active'}
                        onChange={(e) => updateUserAdmin(u.id, { status: e.target.value as User['status'] })}
                        className="px-2 py-1 border"
                      >
                        <option value="active">active</option>
                        <option value="pending">pending</option>
                        <option value="disabled">disabled</option>
                      </select>
                      {u.id !== currentUser?.id && (
                        <button type="button" onClick={() => deleteUserAdmin(u.id)} className="px-2 py-1 border text-rose-400 border-rose-800">删除</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'registration' && (
              <div className="space-y-4">
                <h3 className="font-bold font-mono text-sm uppercase">注册策略 (REGISTRATION)</h3>
                {[
                  { key: 'enabled', label: '开放邮箱注册' },
                  { key: 'requireEmailVerify', label: '注册需邮箱验证码' },
                  { key: 'requireAdminApproval', label: '注册后需管理员审核' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-3 border border-inherit text-xs font-mono">
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={settings.registration[item.key as keyof typeof settings.registration] as boolean}
                      onChange={(e) => setSettings({
                        ...settings,
                        registration: { ...settings.registration, [item.key]: e.target.checked },
                      })}
                      className="w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            )}

            {activeTab === 'mail' && (
              <div className="space-y-4">
                <h3 className="font-bold font-mono text-sm uppercase">SMTP 发件配置 (MAIL)</h3>
                <label className="flex items-center justify-between p-3 border text-xs font-mono">
                  <span>启用邮件发件</span>
                  <input type="checkbox" checked={settings.mail.enabled} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, enabled: e.target.checked } })} />
                </label>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">发件渠道</label>
                  <select
                    value={settings.mail.channel}
                    onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, channel: e.target.value as AdminSettings['mail']['channel'] } })}
                    className="w-full px-3 py-2 border text-xs font-mono"
                  >
                    <option value="netease">网易邮箱 (163/126)</option>
                    <option value="microsoft">微软邮箱 (Outlook/Office365)</option>
                    <option value="resend">Resend API</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="发件人名称" value={settings.mail.fromName} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, fromName: e.target.value } })} className="px-3 py-2 border text-xs font-mono" />
                  <input placeholder="发件邮箱" value={settings.mail.fromEmail} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, fromEmail: e.target.value } })} className="px-3 py-2 border text-xs font-mono" />
                </div>
                {settings.mail.channel === 'netease' && (
                  <div className="space-y-2">
                    <input placeholder="网易 SMTP 账号" value={settings.mail.netease.user} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, netease: { ...settings.mail.netease, user: e.target.value } } })} className="w-full px-3 py-2 border text-xs font-mono" />
                    <input type="password" placeholder="网易 SMTP 授权码" value={settings.mail.netease.pass} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, netease: { ...settings.mail.netease, pass: e.target.value } } })} className="w-full px-3 py-2 border text-xs font-mono" />
                  </div>
                )}
                {settings.mail.channel === 'microsoft' && (
                  <div className="space-y-2">
                    <input placeholder="微软 SMTP 账号" value={settings.mail.microsoft.user} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, microsoft: { ...settings.mail.microsoft, user: e.target.value } } })} className="w-full px-3 py-2 border text-xs font-mono" />
                    <input type="password" placeholder="微软 SMTP 密码" value={settings.mail.microsoft.pass} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, microsoft: { ...settings.mail.microsoft, pass: e.target.value } } })} className="w-full px-3 py-2 border text-xs font-mono" />
                  </div>
                )}
                {settings.mail.channel === 'resend' && (
                  <input type="password" placeholder="Resend API Key" value={settings.mail.resend.apiKey} onChange={(e) => setSettings({ ...settings, mail: { ...settings.mail, resend: { apiKey: e.target.value } } })} className="w-full px-3 py-2 border text-xs font-mono" />
                )}
                <div className="flex gap-2">
                  <input placeholder="测试收件邮箱" value={testMailTo} onChange={(e) => setTestMailTo(e.target.value)} className="flex-1 px-3 py-2 border text-xs font-mono" />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await handleSaveSettings();
                        await apiFetch('/api/mail/test', { method: 'POST', body: JSON.stringify({ to: testMailTo }) });
                        setMailNotice('测试邮件已发送');
                      } catch (e: any) {
                        setMailNotice(e.message);
                      }
                    }}
                    className="px-3 py-2 border text-xs font-mono"
                  >
                    发送测试
                  </button>
                </div>
                {mailNotice && <p className="text-xs font-mono text-slate-400">{mailNotice}</p>}
              </div>
            )}

            {/* 1. DEVICES MANAGEMENT TAB */}
            {activeTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-inherit">
                  <div>
                    <h3 className="font-bold font-mono text-sm uppercase">已连接多端客户端与设备 (CONNECTED CLIENTS)</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      管理 Rust 桌面端托盘守护进程、iOS/Android UniApp 移动端及 Web 浏览器实例
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 animate-pulse"></span>
                    <span>在线节点: {devices.filter(d => d.status === 'online').length}</span>
                  </span>
                </div>

                <div className="space-y-2.5">
                  {devices.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3.5 border flex flex-wrap items-center justify-between gap-3 ${
                        d.isCurrent
                          ? theme.isDark ? 'bg-[#161a29] border-cyan-500/80' : 'bg-slate-50 border-black'
                          : theme.isDark ? 'bg-[#12141e] border-[#2b2e42]' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 border flex items-center justify-center ${
                          d.platform === 'desktop-rust' ? 'bg-indigo-950/60 border-indigo-700 text-indigo-400' : 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                        }`}>
                          {d.platform === 'desktop-rust' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs font-mono">{d.name}</span>
                            {d.isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500 text-black font-bold font-mono">
                                当前操作设备
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap gap-2">
                            <span>版本: {d.clientVersion}</span>
                            <span>•</span>
                            <span>IP: {d.ip}</span>
                            <span>•</span>
                            <span>同步策略: {d.syncInterval}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 border font-mono ${
                          d.status === 'online'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}>
                          {d.status === 'online' ? '● 在线活跃' : '○ 离线挂起'}
                        </span>

                        {!d.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevokeDevice(d.id)}
                            className="px-2.5 py-1 border text-[11px] font-mono text-rose-400 hover:text-rose-300 border-rose-800 hover:bg-rose-950/40 cursor-pointer"
                          >
                            注销断开
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. AI MODEL & PROMPT CONFIG TAB */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="pb-3 border-b border-inherit">
                  <h3 className="font-bold font-mono text-sm uppercase">AI 自然语言引擎与意图识别 (GEMINI AI CONFIGURATION)</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    配置大语言模型版本、发散度 (Temperature)、默认优先级与系统 Prompt 指令
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model Choice */}
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5">
                      选择底层推理大模型 (MODEL)
                    </label>
                    <select
                      value={settings.ai.model}
                      onChange={(e) => setSettings({
                        ...settings,
                        ai: { ...settings.ai, model: e.target.value }
                      })}
                      className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                        theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="gemini-3.7-flash">Gemini 3.7 Flash (推荐 · 超低延迟极速解析)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度复杂多任务拆解)</option>
                      <option value="gemini-flash-lite">Gemini Flash Lite (边缘极速轻量化)</option>
                    </select>
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                      <span>发散度 (TEMPERATURE: {settings.ai.temperature})</span>
                      <span className="text-[10px]">严格模式 0.0 ~ 1.0 创意模式</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={settings.ai.temperature}
                      onChange={(e) => setSettings({
                        ...settings,
                        ai: { ...settings.ai, temperature: parseFloat(e.target.value) }
                      })}
                      className="w-full h-2 bg-slate-700 accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Default Priority & Auto Categorize */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5">
                      缺省默认优先级 (DEFAULT PRIORITY)
                    </label>
                    <select
                      value={settings.ai.defaultPriority}
                      onChange={(e) => setSettings({
                        ...settings,
                        ai: { ...settings.ai, defaultPriority: e.target.value as any }
                      })}
                      className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                        theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="low">低优先级 (Low)</option>
                      <option value="medium">中优先级 (Medium · 默认)</option>
                      <option value="high">高优先级 (High)</option>
                      <option value="urgent">紧急优先级 (Urgent)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.ai.autoCategorize}
                        onChange={(e) => setSettings({
                          ...settings,
                          ai: { ...settings.ai, autoCategorize: e.target.checked }
                        })}
                        className="w-4 h-4 border border-slate-400 accent-cyan-500"
                      />
                      <span>启用 AI 语义自动提取任务分类标签</span>
                    </label>
                  </div>
                </div>

                {/* System Prompt Customizer */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    系统级 SYSTEM PROMPT 提示词注入
                  </label>
                  <textarea
                    rows={4}
                    value={settings.ai.customPrompt}
                    onChange={(e) => setSettings({
                      ...settings,
                      ai: { ...settings.ai, customPrompt: e.target.value }
                    })}
                    className={`w-full p-3 border text-xs font-mono focus:outline-none resize-none leading-relaxed ${
                      theme.isDark ? 'bg-[#141620] border-[#313548] text-cyan-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 3. CATEGORIES MANAGEMENT TAB */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-inherit">
                  <h3 className="font-bold font-mono text-sm uppercase">分类与标签体系管理 (TAXONOMY & CATEGORIES)</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    配置全局可用待办分类、专属配色及图标标识
                  </p>
                </div>

                {/* Add new Category */}
                <div className={`p-3.5 border flex flex-wrap items-center gap-2 ${
                  theme.isDark ? 'bg-[#151722] border-[#31354a]' : 'bg-slate-50 border-slate-300'
                }`}>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="输入新分类名称 (例如：财务审计)"
                    className={`flex-1 min-w-[160px] px-3 py-1.5 border text-xs font-mono focus:outline-none ${
                      theme.isDark ? 'bg-[#1a1d2b] border-[#383c54] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-400">颜色:</span>
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-7 h-7 border border-inherit p-0.5 cursor-pointer bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加分类</span>
                  </button>
                </div>

                {/* Categories Table */}
                <div className="border border-inherit">
                  <div className="grid grid-cols-12 bg-black/10 p-2 text-[11px] font-mono font-bold uppercase text-slate-400 border-b border-inherit">
                    <div className="col-span-4">分类名称</div>
                    <div className="col-span-3">色标代码</div>
                    <div className="col-span-3">关联待办数</div>
                    <div className="col-span-2 text-right">操作</div>
                  </div>
                  <div className="divide-y divide-inherit">
                    {settings.categories.map((c) => {
                      const count = todos.filter(t => t.category === c.name).length;
                      return (
                        <div key={c.id} className="grid grid-cols-12 p-2.5 items-center text-xs font-mono">
                          <div className="col-span-4 flex items-center gap-2 font-bold">
                            <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: c.color }} />
                            <span>{c.name}</span>
                            {c.isSystem && (
                              <span className="text-[9px] px-1 border border-slate-600 text-slate-400">SYS</span>
                            )}
                          </div>
                          <div className="col-span-3 font-mono text-slate-400">{c.color}</div>
                          <div className="col-span-3 text-slate-300 font-bold">{count} 项待办</div>
                          <div className="col-span-2 text-right">
                            {!c.isSystem && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(c.id)}
                                className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. BACKUP & SQLITE TAB */}
            {activeTab === 'backup' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-inherit">
                  <h3 className="font-bold font-mono text-sm uppercase">数据备份、恢复与本地 SQLITE 迁移</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    导出完整待办历史为 JSON 或 Rust SQLite SQL 语句，保障无缝灾备
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className={`p-4 border text-left flex items-start gap-3 transition-colors cursor-pointer ${
                      theme.isDark ? 'bg-[#151722] hover:bg-[#1c1f2e] border-[#31354a]' : 'bg-slate-50 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    <Download className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs font-mono">导出完整 JSON 备份包</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1">
                        包含 {todos.length} 条待办、分类、标签及多端同步配置
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sqlContent = `-- SQLite schema for Rust Tauri\nCREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, title TEXT, priority TEXT, completed INTEGER, created_at TEXT);\n${
                        todos.map(t => `INSERT OR REPLACE INTO todos VALUES ('${t.id}', '${t.title}', '${t.priority}', ${t.completed ? 1 : 0}, '${t.createdAt}');`).join('\n')
                      }`;
                      const blob = new Blob([sqlContent], { type: 'text/sql' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `rust-sqlite-dump-${Date.now()}.sql`;
                      a.click();
                    }}
                    className={`p-4 border text-left flex items-start gap-3 transition-colors cursor-pointer ${
                      theme.isDark ? 'bg-[#151722] hover:bg-[#1c1f2e] border-[#31354a]' : 'bg-slate-50 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    <Database className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs font-mono">导出 Rust SQLite SQL 脚本</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1">
                        直接导入到桌面端本地 SQLite 离线数据库
                      </div>
                    </div>
                  </button>
                </div>

                {/* Import Box */}
                <div className="pt-2">
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    粘贴 JSON 备份数据以恢复 / 合并:
                  </label>
                  <textarea
                    rows={3}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder='{"todos": [...], "settings": {...}}'
                    className={`w-full p-2.5 border text-xs font-mono focus:outline-none resize-none ${
                      theme.isDark ? 'bg-[#141620] border-[#313548] text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  />
                  {importNotice && (
                    <div className="mt-2 text-xs font-mono text-emerald-400 font-bold">
                      {importNotice}
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleImportJson}
                      className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>解析并导入合并</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. API & WEBHOOK TAB */}
            {activeTab === 'api' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-inherit">
                  <h3 className="font-bold font-mono text-sm uppercase">开放 API 凭证与 WEBHOOK 实时推送</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    为第三方脚本、Rust Tauri 守护进程或自动化平台（Zapier / n8n）提供调用接口
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    CORS 允许来源 (跨域客户端)
                  </label>
                  <input
                    type="text"
                    value={settings.apiConfig.corsOrigins}
                    onChange={(e) => setSettings({
                      ...settings,
                      apiConfig: { ...settings.apiConfig, corsOrigins: e.target.value }
                    })}
                    placeholder="* 或 https://your-domain.com"
                    className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                      theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    WEBHOOK 事件回调推送 URL (EVENT DISPATCHER)
                  </label>
                  <input
                    type="url"
                    value={settings.apiConfig.webhookUrl}
                    onChange={(e) => setSettings({
                      ...settings,
                      apiConfig: { ...settings.apiConfig, webhookUrl: e.target.value }
                    })}
                    placeholder="https://webhook.internal.corp/events/todo-sync"
                    className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                      theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* 6. PREFERENCES & HOTKEYS TAB */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-inherit">
                  <h3 className="font-bold font-mono text-sm uppercase">系统级快捷键与原生客户端偏好</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    配置全局热键、触觉震动反馈及声音提醒
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-inherit">
                    <div>
                      <div className="font-bold text-xs font-mono">桌面端全局呼出快捷键 (GLOBAL HOTKEY)</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        按下即刻在 Windows/macOS 呼出极简快速待办输入浮窗
                      </div>
                    </div>
                    <input
                      type="text"
                      value={settings.sync.desktopGlobalHotkey}
                      onChange={(e) => setSettings({
                        ...settings,
                        sync: { ...settings.sync, desktopGlobalHotkey: e.target.value }
                      })}
                      className={`w-32 px-2.5 py-1 text-center border text-xs font-mono font-bold ${
                        theme.isDark ? 'bg-black border-cyan-500 text-cyan-300' : 'bg-white border-black text-black'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-inherit">
                    <div>
                      <div className="font-bold text-xs font-mono">移动端触感震动反馈 (TAPTIC ENGINE)</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        在 UniApp 中手势滑动完成或删除时触发物理轻触震动
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.sync.hapticFeedback}
                      onChange={(e) => setSettings({
                        ...settings,
                        sync: { ...settings.sync, hapticFeedback: e.target.checked }
                      })}
                      className="w-4 h-4 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-inherit">
                    <div>
                      <div className="font-bold text-xs font-mono">自动同步轮询频次 (AUTO SYNC INTERVAL)</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        多端状态变更同步刷新周期 (秒)
                      </div>
                    </div>
                    <select
                      value={settings.sync.autoSyncInterval}
                      onChange={(e) => setSettings({
                        ...settings,
                        sync: { ...settings.sync, autoSyncInterval: parseInt(e.target.value, 10) }
                      })}
                      className={`px-3 py-1 border text-xs font-mono ${
                        theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value={1}>1 秒 (超高频)</option>
                      <option value={5}>5 秒 (推荐平衡)</option>
                      <option value={15}>15 秒 (省电模式)</option>
                      <option value={60}>60 秒 (低频)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
