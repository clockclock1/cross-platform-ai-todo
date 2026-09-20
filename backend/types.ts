export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type UserRole = 'admin' | 'manager' | 'member' | 'guest';
export type UserStatus = 'active' | 'pending' | 'disabled';
export type MailChannel = 'netease' | 'microsoft' | 'resend';
export type ClientPlatform = 'web' | 'desktop-rust' | 'mobile-uniapp';

export interface TodoRecord {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  category: string;
  tags: string[];
  dueDate: string | null;
  dueTime?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  roleName: string;
  avatar: string;
  plan: string;
  status: UserStatus;
  emailVerified: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  devicesCount: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  roleName: string;
  avatar: string;
  plan: string;
  status: UserStatus;
  emailVerified: boolean;
  mustChangePassword: boolean;
  devicesCount: number;
  createdAt: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  platform: ClientPlatform;
  clientVersion: string;
  ip: string;
  lastActive: string;
  status: 'online' | 'idle' | 'offline';
  syncInterval: string;
}

export interface MailConfig {
  enabled: boolean;
  channel: MailChannel;
  fromName: string;
  fromEmail: string;
  netease: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  microsoft: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  resend: {
    apiKey: string;
  };
}

export interface RegistrationConfig {
  enabled: boolean;
  requireEmailVerify: boolean;
  requireAdminApproval: boolean;
}

export interface AppSettings {
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
  categories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    isSystem?: boolean;
  }>;
  apiConfig: {
    webhookUrl: string;
    enablePublicApi: boolean;
    corsOrigins: string;
  };
  mail: MailConfig;
  registration: RegistrationConfig;
}

export interface AppDatabase {
  users: UserRecord[];
  todos: TodoRecord[];
  devices: DeviceRecord[];
  settings: AppSettings;
}

export interface AuthRequestUser {
  id: string;
  role: UserRole;
  email: string;
  username: string;
}

export type AuthUser = AuthRequestUser;
