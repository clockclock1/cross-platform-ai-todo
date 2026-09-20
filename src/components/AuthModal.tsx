import React, { useState } from 'react';
import { X, LogIn, UserPlus, LogOut, ShieldAlert, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const AuthModal: React.FC = () => {
  const {
    currentUser,
    isAuthModalOpen,
    authModalMode,
    mustChangePassword,
    openAuthModal,
    closeAuthModal,
    login,
    register,
    sendVerifyCode,
    changePassword,
    forgotPassword,
    resetPassword,
    logout,
    issueClientToken,
  } = useAuth();
  const { theme } = useTheme();

  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  if (!isAuthModalOpen) return null;

  const inputCls = `w-full px-3 py-2 border text-sm font-mono focus:outline-none ${
    theme.isDark
      ? 'bg-[#181a26] border-[#373a50] text-slate-100 focus:border-cyan-400'
      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
  }`;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    const result = await login(emailOrUser.trim(), password);
    if (!result.ok) setErrorMessage(result.error || '登录失败');
    setIsSubmitting(false);
  };

  const handleSendCode = async () => {
    if (!regEmail.trim()) {
      setErrorMessage('请先填写邮箱');
      return;
    }
    setIsSendingCode(true);
    setErrorMessage('');
    const result = await sendVerifyCode(regEmail.trim());
    if (result.ok) setInfoMessage(result.message || '若可注册，验证码将发送到邮箱');
    else setErrorMessage(result.error || '发送失败');
    setIsSendingCode(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setInfoMessage('');
    const result = await register({
      username: regUsername.trim(),
      email: regEmail.trim(),
      password: regPassword,
      code: verifyCode.trim() || undefined,
    });
    if (!result.ok) setErrorMessage(result.error || '注册失败');
    else if (result.pending) setInfoMessage(result.message || '注册成功，等待审核');
    setIsSubmitting(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    const result = await changePassword(oldPassword, newPassword);
    if (!result.ok) setErrorMessage(result.error || '修改失败');
    else setInfoMessage('密码已更新');
    setIsSubmitting(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    if (verifyCode && newPassword) {
      const result = await resetPassword(regEmail.trim(), verifyCode.trim(), newPassword);
      if (!result.ok) setErrorMessage(result.error || '重置失败');
      else {
        setInfoMessage('密码已重置，请登录');
        openAuthModal('login');
      }
    } else {
      const result = await forgotPassword(regEmail.trim());
      if (!result.ok) setErrorMessage(result.error || '发送失败');
      else setInfoMessage(result.message || '若邮箱已注册，验证码将发送到邮箱');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className={`w-full max-w-md border shadow-2xl overflow-hidden ${
          theme.isDark ? 'bg-[#12141d] border-[#33374d] text-slate-100' : 'bg-white border-slate-400 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-inherit">
          <h3 className="text-sm font-bold tracking-tight uppercase font-mono">
            {authModalMode === 'login' && '用户登录'}
            {authModalMode === 'register' && '邮箱注册'}
            {authModalMode === 'profile' && '账号档案'}
            {authModalMode === 'password' && '修改密码'}
            {authModalMode === 'forgot' && '找回密码'}
          </h3>
          {!mustChangePassword && (
            <button type="button" onClick={closeAuthModal} className="p-1 text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!mustChangePassword && authModalMode !== 'password' && authModalMode !== 'forgot' && (
          <div className="grid grid-cols-2 border-b border-inherit bg-black/5 text-xs font-mono">
            <button type="button" onClick={() => openAuthModal('login')} className={`py-2 ${authModalMode === 'login' ? 'bg-black text-white font-bold' : 'text-slate-400'}`}>登录</button>
            <button type="button" onClick={() => openAuthModal('register')} className={`py-2 ${authModalMode === 'register' ? 'bg-black text-white font-bold' : 'text-slate-400'}`}>注册</button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {mustChangePassword && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-800 text-amber-200 text-xs">首次登录必须修改初始密码后才能继续使用。</div>
          )}
          {errorMessage && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {infoMessage && <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs">{infoMessage}</div>}

          {authModalMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">邮箱 / 用户名</label>
                <input type="text" required value={emailOrUser} onChange={(e) => setEmailOrUser(e.target.value)} className={inputCls} autoComplete="username" />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">密码</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="current-password" />
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 border text-xs font-bold uppercase flex items-center justify-center gap-2 ${theme.isDark ? 'bg-cyan-500 text-black' : 'bg-black text-white'}`}>
                <LogIn className="w-3.5 h-3.5" />
                {isSubmitting ? '登录中...' : '登录'}
              </button>
              <button type="button" onClick={() => openAuthModal('forgot')} className="text-xs font-mono text-slate-400 hover:underline">忘记密码？</button>
            </form>
          )}

          {authModalMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">用户名</label>
                <input type="text" required maxLength={32} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">邮箱</label>
                <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">密码（≥8 位，含字母和数字）</label>
                <input type="password" required minLength={8} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">邮箱验证码</label>
                <div className="flex gap-2">
                  <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className={inputCls} />
                  <button type="button" onClick={handleSendCode} disabled={isSendingCode} className="px-3 border text-xs font-mono shrink-0 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {isSendingCode ? '发送中' : '获取验证码'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 border text-xs font-bold uppercase flex items-center justify-center gap-2 ${theme.isDark ? 'bg-cyan-500 text-black' : 'bg-black text-white'}`}>
                <UserPlus className="w-3.5 h-3.5" />
                {isSubmitting ? '注册中...' : '完成注册'}
              </button>
            </form>
          )}

          {(authModalMode === 'password' || mustChangePassword) && authModalMode !== 'forgot' && authModalMode !== 'login' && authModalMode !== 'register' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">原密码</label>
                <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">新密码（≥8 位，含字母和数字）</label>
                <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 border text-xs font-bold uppercase flex items-center justify-center gap-2 ${theme.isDark ? 'bg-cyan-500 text-black' : 'bg-black text-white'}`}>
                <KeyRound className="w-3.5 h-3.5" />
                {isSubmitting ? '提交中...' : '确认修改'}
              </button>
            </form>
          )}

          {authModalMode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">注册邮箱</label>
                <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">验证码（先点下方发送）</label>
                <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">新密码</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full py-2.5 border text-xs font-bold ${theme.isDark ? 'bg-cyan-500 text-black' : 'bg-black text-white'}`}>
                {isSubmitting ? '处理中...' : verifyCode && newPassword ? '重置密码' : '发送重置验证码'}
              </button>
              <button type="button" onClick={() => openAuthModal('login')} className="text-xs font-mono text-slate-400">返回登录</button>
            </form>
          )}

          {authModalMode === 'profile' && currentUser && (
            <div className="space-y-4">
              <div className={`p-4 border ${theme.isDark ? 'bg-[#181b28] border-[#31354c]' : 'bg-slate-50 border-slate-300'}`}>
                <h4 className="font-bold text-sm font-mono">{currentUser.username}</h4>
                <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
                <p className="text-[11px] text-slate-400 mt-1">{currentUser.roleName}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const result = await issueClientToken();
                  if (result.ok && result.token) setClientToken(result.token);
                  else setErrorMessage(result.error || '生成失败');
                }}
                className="w-full px-3 py-2 border text-xs font-mono"
              >
                生成桌面/移动端同步令牌（一次性复制，不常驻展示）
              </button>
              {clientToken && (
                <div className={`p-2.5 border font-mono text-[11px] break-all ${theme.isDark ? 'bg-[#0e0f16] border-[#292c3e]' : 'bg-slate-100 border-slate-300'}`}>
                  {clientToken}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => openAuthModal('password')} className="px-3 py-1.5 border text-xs font-mono">修改密码</button>
                <button type="button" onClick={async () => { await logout(); closeAuthModal(); }} className="px-3 py-1.5 border text-xs font-mono text-rose-400 border-rose-800 flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> 退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
