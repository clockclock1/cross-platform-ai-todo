import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  ListTodo,
  Sparkles,
  Calendar,
  Layers,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  User,
  Shield,
  ArrowUpDown,
  Tag,
  Monitor,
  Smartphone,
  Globe,
  Settings,
  LogIn,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TodoItem, FilterStatus, SortOption, PlatformView, AIActionResponse } from './types';
import { apiFetch } from './lib/api';
import { AIAssistantBar } from './components/AIAssistantBar';
import { TodoItemRow } from './components/TodoItemRow';
import { AddEditModal } from './components/AddEditModal';
import { PlatformSimulator } from './components/PlatformSimulator';
import { ThemeSelector } from './components/ThemeSelector';
import { AuthModal } from './components/AuthModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';

function MainTodoApp() {
  const { theme } = useTheme();
  const { currentUser, openAuthModal, isLoading: authLoading } = useAuth();

  // Todos state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoadingTodos, setIsLoadingTodos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt');
  const [currentPlatform, setCurrentPlatform] = useState<PlatformView>('web');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);

  // AI execution state
  const [isAILoading, setIsAILoading] = useState(false);
  const [lastAIResult, setLastAIResult] = useState<AIActionResponse | null>(null);
  const [listStats, setListStats] = useState({ total: 0, activeCount: 0, completedCount: 0, todayCount: 0, upcomingCount: 0 });

  // Fetch todos from backend
  const fetchTodos = async () => {
    if (!currentUser) return;
    try {
      setIsLoadingTodos(true);
      const params = new URLSearchParams({
        status: filterStatus,
        category: selectedCategory,
        priority: selectedPriority,
        sort: sortBy,
        page: '1',
        pageSize: '100',
      });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const data = await apiFetch<{
        success: boolean;
        data: TodoItem[];
        total: number;
        activeCount: number;
        completedCount: number;
        todayCount: number;
        upcomingCount: number;
      }>(`/api/todos?${params.toString()}`);
      if (data.success && Array.isArray(data.data)) {
        setTodos(data.data);
        setListStats({
          total: data.total,
          activeCount: data.activeCount,
          completedCount: data.completedCount,
          todayCount: data.todayCount,
          upcomingCount: data.upcomingCount,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch todos', err);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [currentUser?.id, filterStatus, selectedCategory, selectedPriority, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentUser) fetchTodos();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Unique categories derived from todos and defaults
  const categoriesList = useMemo(() => {
    const defaultCats = ['工作', '学习', '生活', '健康', '灵感'];
    const fromTodos = todos.map(t => t.category).filter(Boolean);
    return Array.from(new Set([...defaultCats, ...fromTodos]));
  }, [todos]);

  // Handle Toggle
  const handleToggleTodo = async (id: string) => {
    // Optimistic UI update
    setTodos(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
          : t
      )
    );

    try {
      await apiFetch(`/api/todos/${id}/toggle`, { method: 'PATCH' });
    } catch (err) {
      fetchTodos(); // rollback if error
    }
  };

  // Handle Delete
  const handleDeleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await apiFetch(`/api/todos/${id}`, { method: 'DELETE' });
    } catch (err) {
      fetchTodos();
    }
  };

  // Handle Save (Add or Edit)
  const handleSaveTodo = async (todoData: Partial<TodoItem>) => {
    if (editingTodo) {
      // Edit
      try {
        const data = await apiFetch<{ success: boolean; data: TodoItem }>(`/api/todos/${editingTodo.id}`, {
          method: 'PUT',
          body: JSON.stringify(todoData),
        });
        if (data.success && data.data) {
          setTodos(prev => prev.map(t => (t.id === editingTodo.id ? data.data : t)));
        }
      } catch (err) {
        fetchTodos();
      }
      setEditingTodo(null);
    } else {
      // Create
      try {
        const data = await apiFetch<{ success: boolean; data: TodoItem }>('/api/todos', {
          method: 'POST',
          body: JSON.stringify(todoData),
        });
        if (data.success && data.data) {
          setTodos(prev => [data.data, ...prev]);
        }
      } catch (err) {
        fetchTodos();
      }
    }
  };

  // Clear completed
  const handleClearCompleted = async () => {
    const completedCount = todos.filter(t => t.completed).length;
    if (completedCount === 0) return;

    setTodos(prev => prev.filter(t => !t.completed));
    try {
      await apiFetch('/api/todos/clear-completed', { method: 'POST' });
    } catch (err) {
      fetchTodos();
    }
  };

  // Execute Gemini AI Prompt
  const handleExecuteAIPrompt = async (prompt: string): Promise<AIActionResponse | null> => {
    setIsAILoading(true);
    setLastAIResult(null);
    try {
      const data = await apiFetch<{ success: boolean; aiResult: AIActionResponse }>('/api/ai/todo-action', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      if (data.success && data.aiResult) {
        setLastAIResult(data.aiResult);
        await fetchTodos();
        return data.aiResult;
      }
    } catch (err) {
      console.error('AI execution error', err);
    } finally {
      setIsAILoading(false);
    }
    return null;
  };

  // Server already filtered/sorted; keep light client pass for consistency
  const filteredAndSortedTodos = todos;

  const totalCount = listStats.total;
  const activeCount = listStats.activeCount;
  const completedCount = listStats.completedCount;
  const todayCount = listStats.todayCount;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150`}>
      {/* Top Application Bar (Strictly sharp with 0px rounded corners) */}
      <header className={`sticky top-0 z-40 px-4 sm:px-6 py-3.5 border-b backdrop-blur-md ${theme.headerBg}`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & App Info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black flex items-center justify-center text-white text-xs font-mono font-bold border border-black select-none">
              ✓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold font-mono tracking-tight uppercase">
                  CROSS-PLATFORM AI TODO
                </h1>
                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 border border-inherit font-mono opacity-80">
                  SHARP ARCHITECTURE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                前后端分离 · Rust桌面三端 / UniApp移动双端 / React网页端 · 多主题无圆角设计
              </p>
            </div>
          </div>

          {/* Right Action Controls: Theme + User + Admin */}
          <div className="flex items-center gap-2">
            {/* Theme Selector */}
            <ThemeSelector />

            {/* User Account / Profile button */}
            <button
              id="user-account-btn"
              type="button"
              onClick={() => openAuthModal(currentUser ? 'profile' : 'login')}
              className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-mono transition-all cursor-pointer select-none ${
                theme.isDark
                  ? 'bg-[#181a24] hover:bg-[#222534] border-[#32354a] text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
              title="用户账号管理与多端鉴权"
            >
              {currentUser ? (
                <>
                  <img src={currentUser.avatar} alt="avatar" className="w-4 h-4 border border-black/40 object-cover" />
                  <span className="max-w-[80px] sm:max-w-[120px] truncate">{currentUser.username}</span>
                  <span className={`text-[9px] px-1 border uppercase ${
                    currentUser.role === 'admin' ? 'border-rose-700 text-rose-400 bg-rose-950/40' : 'border-slate-600 text-slate-400'
                  }`}>
                    {currentUser.role}
                  </span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5" />
                  <span>登录账号</span>
                </>
              )}
            </button>

            {/* Admin Management Button */}
            <button
              id="admin-settings-btn"
              type="button"
              onClick={() => currentUser?.role === 'admin' ? setIsAdminSettingsOpen(true) : openAuthModal('login')}
              className={`p-2 border text-xs font-mono transition-all cursor-pointer ${
                theme.isDark
                  ? 'bg-[#181a24] hover:bg-[#222534] border-[#32354a] text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
              title="打开系统管理后台 (AI参数 / 设备连接 / 数据备份)"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {!authLoading && !currentUser && (
          <div className={`p-8 border text-center font-mono ${theme.isDark ? 'bg-[#12141d] border-[#292c3e]' : 'bg-white border-slate-300'}`}>
            <Shield className="w-8 h-8 mx-auto mb-3 text-slate-400" />
            <p className="font-bold mb-2">请先登录以同步您的待办</p>
            <p className="text-xs text-slate-400 mb-4">同账号可在 Web / 桌面端 / 移动端全平台互通</p>
            <button type="button" onClick={() => openAuthModal('login')} className={`px-4 py-2 border text-xs font-bold ${theme.isDark ? 'bg-cyan-500 text-black' : 'bg-black text-white'}`}>
              <LogIn className="w-3.5 h-3.5 inline mr-1" /> 立即登录
            </button>
          </div>
        )}

        {currentUser && (
          <>
        {/* Gemini AI Assistant Component */}
        <AIAssistantBar
          onExecutePrompt={handleExecuteAIPrompt}
          isLoading={isAILoading}
          lastAIResult={lastAIResult}
        />

        {/* Cross-Platform Architecture Simulator */}
        <PlatformSimulator
          todos={todos}
          currentPlatform={currentPlatform}
          onSelectPlatform={setCurrentPlatform}
          onToggleTodo={handleToggleTodo}
          onOpenAdminSettings={() => setIsAdminSettingsOpen(true)}
        />

        {/* Web Todo Manager Section (Active when in Web or Full view) */}
        {currentPlatform === 'web' && (
          <div className="space-y-4">
            {/* Control Bar: Filters, Search, Add Button */}
            <div className={`p-4 border space-y-3 ${
              theme.isDark ? 'bg-[#12141e] border-[#2c3044]' : 'bg-white border-slate-300 shadow-2xs'
            }`}>
              {/* Row 1: Search & New Todo Button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 select-none" />
                  <input
                    id="search-todo-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索待办标题、分类或标签..."
                    className={`w-full pl-9 pr-3 py-2 border text-xs sm:text-sm font-mono focus:outline-none ${
                      theme.isDark
                        ? 'bg-[#181a26] border-[#373a50] text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="add-new-todo-btn"
                    type="button"
                    onClick={() => {
                      setEditingTodo(null);
                      setIsAddModalOpen(true);
                    }}
                    className={`px-4 py-2 border text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                      theme.isDark
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400'
                        : 'bg-black hover:bg-neutral-800 text-white border-black'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>新建待办</span>
                  </button>

                  <button
                    id="refresh-todos-btn"
                    type="button"
                    onClick={fetchTodos}
                    disabled={isLoadingTodos}
                    className={`p-2 border text-xs font-mono transition-colors cursor-pointer ${
                      theme.isDark ? 'border-[#33374e] text-slate-300 hover:bg-[#1a1d2c]' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="从后端同步刷新"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingTodos ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Row 2: Status Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-inherit font-mono text-xs">
                {/* Status Tabs */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'all', label: '全部待办', count: totalCount },
                    { id: 'active', label: '进行中', count: activeCount },
                    { id: 'today', label: '今日到期', count: todayCount },
                    { id: 'upcoming', label: '近期任务', count: listStats.upcomingCount },
                    { id: 'completed', label: '已完成', count: completedCount },
                  ].map((tab) => {
                    const isSelected = filterStatus === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`filter-tab-${tab.id}`}
                        type="button"
                        onClick={() => setFilterStatus(tab.id as FilterStatus)}
                        className={`px-3 py-1.5 border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? theme.isDark
                              ? 'bg-[#1f2334] border-cyan-500/80 text-cyan-400 font-bold'
                              : 'bg-slate-100 border-black text-black font-bold'
                            : theme.isDark
                            ? 'border-transparent text-slate-400 hover:bg-[#181a26] hover:text-slate-200'
                            : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1 py-0.2 border ${
                          isSelected
                            ? theme.isDark ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300' : 'border-black bg-black text-white'
                            : 'border-inherit text-slate-400'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Clear Completed Action */}
                {completedCount > 0 && (
                  <button
                    id="clear-completed-btn"
                    type="button"
                    onClick={handleClearCompleted}
                    className="text-xs font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1 py-1 px-2 border border-transparent hover:border-rose-900/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空已完成 ({completedCount})</span>
                  </button>
                )}
              </div>

              {/* Row 3: Category, Priority, Sort Selectors */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-400">
                {/* Category dropdown */}
                <div className="flex items-center gap-1.5">
                  <span>分类:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`px-2 py-1 border text-xs focus:outline-none ${
                      theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="all">全部分类 (ALL)</option>
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority dropdown */}
                <div className="flex items-center gap-1.5">
                  <span>优先级:</span>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className={`px-2 py-1 border text-xs focus:outline-none ${
                      theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="all">全部级别 (ALL)</option>
                    <option value="urgent">紧急 (Urgent)</option>
                    <option value="high">高 (High)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="low">低 (Low)</option>
                  </select>
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <ArrowUpDown className="w-3 h-3" />
                  <span>排序:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className={`px-2 py-1 border text-xs focus:outline-none ${
                      theme.isDark ? 'bg-[#181a26] border-[#373a50] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="createdAt">按创建时间</option>
                    <option value="dueDate">按截止日期</option>
                    <option value="priority">按优先级高低</option>
                    <option value="title">按标题拼音</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Todo List Rows */}
            <div className="space-y-2">
              {filteredAndSortedTodos.length === 0 ? (
                <div className={`p-10 border text-center font-mono text-xs ${
                  theme.isDark ? 'bg-[#12141d] border-[#292c3e] text-slate-400' : 'bg-white border-slate-300 text-slate-600'
                }`}>
                  <ListTodo className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="font-bold text-sm">暂无匹配的待办事项</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    点击右上角【新建待办】或直接在上方 AI 助手输入框下达自然语言指令
                  </p>
                </div>
              ) : (
                filteredAndSortedTodos.map((todo) => (
                  <TodoItemRow
                    key={todo.id}
                    todo={todo}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                    onEdit={(t) => {
                      setEditingTodo(t);
                      setIsAddModalOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer className={`mt-auto border-t px-4 sm:px-6 py-2.5 font-mono text-[11px] ${
        theme.isDark ? 'bg-[#0a0b10] border-[#1e212d] text-slate-500' : 'bg-slate-100 border-slate-300 text-slate-600'
      }`}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-2 h-2 bg-emerald-500"></span>
              <span>REST API 同步网关: 正常运行中 (PORT 3000)</span>
            </span>
            <span>•</span>
            <span>支持平台: Win / Mac / Linux / iOS / Android / Web</span>
          </div>
          <div>
            <span>当前风格: {theme.name} (无圆角几何工业范式)</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddEditModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTodo(null);
        }}
        onSave={handleSaveTodo}
        initialTodo={editingTodo}
        categories={categoriesList}
      />

      <AuthModal />

      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
        todos={todos}
        onRefreshTodos={fetchTodos}
        categories={categoriesList}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainTodoApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
