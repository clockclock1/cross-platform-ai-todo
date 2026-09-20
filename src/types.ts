export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  category: string;
  tags: string[];
  dueDate: string | null; // ISO date string or 'YYYY-MM-DD'
  dueTime?: string | null; // e.g. '14:30'
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export type FilterStatus = 'all' | 'active' | 'completed' | 'today' | 'upcoming';
export type SortOption = 'createdAt' | 'dueDate' | 'priority' | 'title';

export interface AIActionResponse {
  action: 'CREATE_TODO' | 'COMPLETE_TODO' | 'DELETE_TODO' | 'UPDATE_TODO' | 'BATCH_CREATE' | 'CLEAR_COMPLETED' | 'QUERY_INFO' | 'UNKNOWN';
  message: string;
  createdTodos?: Array<{
    title: string;
    description?: string;
    priority?: Priority;
    category?: string;
    dueDate?: string | null;
    dueTime?: string | null;
    tags?: string[];
  }>;
  targetTitles?: string[];
  targetIds?: string[];
  updates?: {
    completed?: boolean;
    priority?: Priority;
    dueDate?: string | null;
    category?: string;
    tags?: string[];
  };
  explanation: string;
  success?: boolean;
}

export type PlatformView = 'web' | 'desktop-rust' | 'mobile-uniapp' | 'architecture';

export type ThemeId = 
  | 'sharp-light'       // 极简纯白 (Swiss Minimal Light)
  | 'sharp-dark'        // 暗黑黑曜石 (Cyber Obsidian Dark)
  | 'sharp-slate'       // 钛金冷灰工坊 (Titanium Studio Slate)
  | 'sharp-amber'       // 黑客琥珀终端 (Retro Amber Terminal)
  | 'sharp-navy'        // 深海极光蓝 (Deep Navy Aurora)
  | 'sharp-monochrome'; // 工业包豪斯 (Industrial Monochrome)

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'guest';
  roleName: string;
  avatar: string;
  plan: string;
  status?: 'active' | 'pending' | 'disabled';
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  devicesCount: number;
  createdAt: string;
}

export type MailChannel = 'netease' | 'microsoft' | 'resend';

export interface MailConfig {
  enabled: boolean;
  channel: MailChannel;
  fromName: string;
  fromEmail: string;
  netease: { host: string; port: number; secure: boolean; user: string; pass: string };
  microsoft: { host: string; port: number; secure: boolean; user: string; pass: string };
  resend: { apiKey: string };
}

export interface RegistrationConfig {
  enabled: boolean;
  requireEmailVerify: boolean;
  requireAdminApproval: boolean;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  platform: 'desktop-rust' | 'mobile-uniapp' | 'web';
  clientVersion: string;
  ip: string;
  lastActive: string;
  status: 'online' | 'idle' | 'offline';
  syncInterval: string;
  isCurrent?: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem?: boolean;
}

export interface AdminSettings {
  ai: {
    model: string;
    temperature: number;
    autoCategorize: boolean;
    defaultPriority: Priority;
    customPrompt: string;
    enableIntentAutoExecute: boolean;
  };
  sync: {
    autoSyncInterval: number;
    enableOfflineSQLite: boolean;
    desktopGlobalHotkey: string;
    hapticFeedback: boolean;
    soundOnComplete: boolean;
    autoPurgeDays: number;
  };
  categories: CategoryItem[];
  apiConfig: {
    webhookUrl: string;
    enablePublicApi: boolean;
    corsOrigins: string;
  };
  mail: MailConfig;
  registration: RegistrationConfig;
}
