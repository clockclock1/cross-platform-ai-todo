import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiFetch, getToken, setToken } from '../lib/api';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  mustChangePassword: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'profile' | 'switch' | 'password' | 'forgot';
  openAuthModal: (mode?: AuthContextType['authModalMode']) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (payload: {
    username: string;
    email: string;
    password: string;
    code?: string;
  }) => Promise<{ ok: boolean; pending?: boolean; message?: string; error?: string }>;
  sendVerifyCode: (email: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
  resetPassword: (email: string, code: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  updateUserAdmin: (userId: string, patch: Partial<User>) => Promise<void>;
  deleteUserAdmin: (userId: string) => Promise<void>;
  issueClientToken: () => Promise<{ ok: boolean; token?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthContextType['authModalMode']>('login');

  const mustChangePassword = Boolean(currentUser?.mustChangePassword);

  const refreshUsers = useCallback(async () => {
    try {
      const json = await apiFetch<{ success: boolean; data: User[] }>('/api/auth/users');
      if (json.success) setUsers(json.data);
    } catch {
      /* 非管理员忽略 */
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const json = await apiFetch<{ success: boolean; user: User }>('/api/auth/me');
      if (json.success) {
        setCurrentUser(json.user);
        if (json.user.role === 'admin') await refreshUsers();
        if (json.user.mustChangePassword) {
          setAuthModalMode('password');
          setIsAuthModalOpen(true);
        }
      }
    } catch (err: any) {
      if (err?.code === 'MUST_CHANGE_PASSWORD') {
        setAuthModalMode('password');
        setIsAuthModalOpen(true);
      }
      setToken(null);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUsers]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const openAuthModal = (mode: AuthContextType['authModalMode'] = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    if (mustChangePassword) return;
    setIsAuthModalOpen(false);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ success: boolean; user: User; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, platform: 'web' }),
      });
      if (data.token) setToken(data.token);
      else setToken(null);
      setCurrentUser(data.user);
      setIsAuthModalOpen(false);
      if (data.user.mustChangePassword) {
        setAuthModalMode('password');
        setIsAuthModalOpen(true);
      }
      if (data.user.role === 'admin') await refreshUsers();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const sendVerifyCode = async (email: string) => {
    try {
      const data = await apiFetch<{ success: boolean; message?: string }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { ok: true, message: data.message };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  const register = async (payload: { username: string; email: string; password: string; code?: string }) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        success: boolean;
        user: User;
        token?: string;
        pending?: boolean;
        message?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.pending) return { ok: true, pending: true, message: data.message };
      if (data.token) setToken(data.token);
      else setToken(null);
      setCurrentUser(data.user);
      setIsAuthModalOpen(false);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      const data = await apiFetch<{ success: boolean; user: User }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setToken(null);
      setCurrentUser(data.user);
      setIsAuthModalOpen(false);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const data = await apiFetch<{ success: boolean; message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { ok: true, message: data.message };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* ignore */
    }
    setToken(null);
    setCurrentUser(null);
    setUsers([]);
  };

  const updateUserAdmin = async (userId: string, patch: Partial<User>) => {
    await apiFetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await refreshUsers();
  };

  const deleteUserAdmin = async (userId: string) => {
    await apiFetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
    await refreshUsers();
  };

  const issueClientToken = async () => {
    try {
      const data = await apiFetch<{ success: boolean; token: string }>('/api/auth/client-token', {
        method: 'POST',
        body: JSON.stringify({ platform: 'desktop-rust', deviceName: '手动复制令牌' }),
      });
      return { ok: true, token: data.token };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isLoading,
        mustChangePassword,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        sendVerifyCode,
        changePassword,
        forgotPassword,
        resetPassword,
        logout,
        refreshUsers,
        updateUserAdmin,
        deleteUserAdmin,
        issueClientToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
