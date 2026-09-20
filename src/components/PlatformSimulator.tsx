import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Globe,
  Layers,
  Code2,
  CheckCircle,
  Terminal,
  Cpu,
  RefreshCw,
  HardDrive,
  Copy,
  ExternalLink,
  Sliders,
  Sparkles,
  Shield,
  Clock,
  Radio,
  FileCode,
  Box
} from 'lucide-react';
import { TodoItem, PlatformView } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface PlatformSimulatorProps {
  todos: TodoItem[];
  currentPlatform: PlatformView;
  onSelectPlatform: (platform: PlatformView) => void;
  onToggleTodo: (id: string) => void;
  onOpenAdminSettings?: () => void;
}

export const PlatformSimulator: React.FC<PlatformSimulatorProps> = ({
  todos,
  currentPlatform,
  onSelectPlatform,
  onToggleTodo,
  onOpenAdminSettings,
}) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const [activeCodeTab, setActiveCodeTab] = useState<'rust' | 'uniapp' | 'rest' | 'sqlite'>('rust');
  const [copied, setCopied] = useState(false);

  const pendingTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const RUST_CODE = `// src-tauri/src/main.rs - Rust Tauri 2.0 Native Daemon
// Target: Windows (Win32 API) / macOS (Cocoa) / Linux (GTK)
use tauri::{CustomMenuItem, SystemTray, SystemTrayMenu, SystemTrayEvent};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RustTodo {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub priority: String,
}

#[tauri::command]
fn sync_todos_from_cloud(api_url: String, jwt_token: String) -> Result<Vec<RustTodo>, String> {
    let client = Client::new();
    let resp = client.get(&format!("{}/api/todos", api_url))
        .bearer_auth(jwt_token)
        .send()
        .map_err(|e| e.to_string())?;
    
    let todos: Vec<RustTodo> = resp.json().map_err(|e| e.to_string())?;
    Ok(todos)
}

#[tauri::command]
fn register_global_hotkey(hotkey: String) {
    // 注册全局热键唤醒极简待办浮窗
    println!("[Rust Desktop] Registered Global Shortcut: {}", hotkey);
}

fn main() {
    let tray = SystemTray::new().with_menu(
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new("open", "打开待办工坊"))
            .add_item(CustomMenuItem::new("ai_quick", "AI 快速创建 (Cmd+Shift+T)"))
            .add_item(CustomMenuItem::new("quit", "退出客户端"))
    );

    tauri::Builder::default()
        .system_tray(tray)
        .invoke_handler(tauri::generate_handler![sync_todos_from_cloud, register_global_hotkey])
        .run(tauri::generate_context!())
        .expect("error while running Rust Tauri app");
}`;

  const UNIAPP_CODE = `<!-- pages/index/index.vue - UniApp (iOS & Android & 微信小程序) -->
<template>
  <view class="app-container">
    <!-- 原生导航栏 -->
    <view class="nav-bar">
      <text class="title">CROSS-TODO (UniApp)</text>
      <text class="status-badge">已连接 {{ activeCount }} 项</text>
    </view>

    <!-- 待办手势滑动列表 -->
    <scroll-view scroll-y class="todo-list" @refresherrefresh="onPullDownRefresh" :refresher-enabled="true">
      <view 
        v-for="item in todoList" 
        :key="item.id"
        class="todo-item"
        :class="{ completed: item.completed }"
        @click="toggleItem(item.id)"
      >
        <view class="checkbox" :class="{ checked: item.completed }">
          <text v-if="item.completed">✓</text>
        </view>
        <text class="text">{{ item.title }}</text>
        <text class="priority-tag" :class="item.priority">{{ item.priority }}</text>
      </view>
    </scroll-view>

    <!-- 底部 AI 语音与指令条 -->
    <view class="ai-input-bar">
      <input v-model="aiPrompt" placeholder="语音或输入对 AI 说..." />
      <button @click="executeAI">AI 执行</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const todoList = ref([]);
const aiPrompt = ref('');

const fetchTodos = async () => {
  uni.request({
    url: 'https://api.corp.io/api/todos',
    header: { 'Authorization': 'Bearer ' + uni.getStorageSync('jwt_token') },
    success: (res) => {
      todoList.value = res.data.data;
      uni.vibrateShort({ type: 'light' }); // 震动触觉反馈
    }
  });
};

const toggleItem = (id: string) => {
  uni.vibrateShort({ type: 'medium' });
  uni.request({
    url: \`https://api.corp.io/api/todos/\${id}/toggle\`,
    method: 'PATCH',
    success: () => fetchTodos()
  });
};
</script>`;

  const REST_SPEC = `// RESTful API Contract for Cross-Platform Sync
GET    /api/todos              // 获取待办列表 (支持 status/category/priority/search 过滤)
POST   /api/todos              // 创建新待办事项
PUT    /api/todos/:id          // 更新待办事项
PATCH  /api/todos/:id/toggle   // 快速切换完成状态
DELETE /api/todos/:id          // 删除待办事项
POST   /api/todos/batch        // 批量创建待办
POST   /api/ai/todo-action     // Gemini AI 自然语言解析与意图调度
POST   /api/auth/login         // 多端账号认证与 JWT 令牌发放
GET    /api/settings           // 获取管理后台配置与同步节点状态
GET    /api/backup/export      // 导出全量备份数据`;

  const SQLITE_SCHEMA = `-- Rust Desktop Local Offline Cache (SQLite 3)
CREATE TABLE IF NOT EXISTS local_todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    category TEXT DEFAULT '工作',
    due_date TEXT,
    due_time TEXT,
    sync_status TEXT DEFAULT 'synced', -- 'synced' | 'pending_upload' | 'conflict'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_todos_status ON local_todos(completed, priority);`;

  const copyCurrentCode = () => {
    const code = activeCodeTab === 'rust' ? RUST_CODE : activeCodeTab === 'uniapp' ? UNIAPP_CODE : activeCodeTab === 'rest' ? REST_SPEC : SQLITE_SCHEMA;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Platform Switcher Tabs (Sharp rectangular controls) */}
      <div className={`p-1.5 border flex flex-wrap items-center justify-between gap-2 font-mono text-xs ${
        theme.isDark ? 'bg-[#10121a] border-[#292c3d]' : 'bg-white border-slate-300 shadow-2xs'
      }`}>
        <div className="flex items-center gap-1">
          {[
            { id: 'web', label: '网页前端 (React 19)', icon: Globe },
            { id: 'desktop-rust', label: '桌面三端 (Rust + Tauri)', icon: Monitor },
            { id: 'mobile-uniapp', label: '移动多端 (UniApp)', icon: Smartphone },
            { id: 'architecture', label: '前后端分离架构代码', icon: Code2 },
          ].map((p) => {
            const Icon = p.icon;
            const isSelected = currentPlatform === p.id;
            return (
              <button
                key={p.id}
                id={`platform-btn-${p.id}`}
                type="button"
                onClick={() => onSelectPlatform(p.id as PlatformView)}
                className={`px-3 py-1.5 border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? theme.isDark
                      ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                      : 'bg-black text-white border-black font-bold'
                    : theme.isDark
                    ? 'border-transparent text-slate-400 hover:bg-[#181a26] hover:text-slate-200'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Admin quick action */}
        {onOpenAdminSettings && (
          <button
            id="quick-open-admin-btn"
            type="button"
            onClick={onOpenAdminSettings}
            className={`px-3 py-1.5 border flex items-center gap-1.5 transition-colors cursor-pointer ${
              theme.isDark
                ? 'border-[#383c54] text-cyan-300 hover:bg-[#1a1e2d]'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>管理后台配置</span>
          </button>
        )}
      </div>

      {/* 1. DESKTOP RUST TAURI MOCK VIEW */}
      {currentPlatform === 'desktop-rust' && (
        <div className={`border overflow-hidden ${
          theme.isDark ? 'bg-[#0f1118] border-[#2d3044]' : 'bg-[#f1f5f9] border-slate-400'
        }`}>
          {/* Window Titlebar (Zero rounded corners) */}
          <div className="bg-[#1e2029] text-slate-300 px-4 py-2 flex items-center justify-between border-b border-black text-xs font-mono select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 border border-black/40 inline-block"></div>
              <div className="w-3 h-3 bg-amber-500 border border-black/40 inline-block"></div>
              <div className="w-3 h-3 bg-emerald-500 border border-black/40 inline-block"></div>
              <span className="ml-2 font-bold text-white">Cross-Platform Todo — Rust Tauri Native v2.4 (Windows/macOS/Linux)</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="bg-black/60 px-2 py-0.5 border border-slate-700 text-emerald-400">● 托盘守护运行中</span>
              <span>全局快捷键: Cmd+Shift+T</span>
            </div>
          </div>

          {/* Desktop App Interior */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left sidebar */}
            <div className={`md:col-span-4 border p-3.5 space-y-3 font-mono text-xs ${
              theme.isDark ? 'bg-[#141622] border-[#292c3e]' : 'bg-white border-slate-300'
            }`}>
              <div className="font-bold uppercase text-[11px] text-slate-400 pb-2 border-b border-inherit">
                原生底层引擎状态 (RUST CORE)
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">GUI 框架:</span>
                  <span className="font-bold">Tauri 2.0 (WebView2/WebKitGTK)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">本地数据库:</span>
                  <span className="font-bold text-emerald-500">SQLite3 离线零延迟</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">内存占用:</span>
                  <span className="font-bold text-cyan-400">~24.6 MB (超轻量)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">同步协议:</span>
                  <span className="font-bold">REST + SSE 双向触发</span>
                </div>
              </div>

              <div className="pt-2 border-t border-inherit">
                <div className="text-[10px] text-slate-400 mb-1.5 uppercase font-bold">桌面托盘右键菜单:</div>
                <div className="space-y-1 text-xs">
                  <div className="p-1.5 border border-inherit bg-black/5 hover:bg-black/10 cursor-pointer flex justify-between">
                    <span>快速呼出 AI 待办浮窗</span>
                    <span className="opacity-60">⌘⇧T</span>
                  </div>
                  <div className="p-1.5 border border-inherit bg-black/5 hover:bg-black/10 cursor-pointer flex justify-between">
                    <span>手动强制拉取最新数据</span>
                    <span className="opacity-60">F5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right todo list preview */}
            <div className={`md:col-span-8 border p-4 space-y-3 ${
              theme.isDark ? 'bg-[#141622] border-[#292c3e]' : 'bg-white border-slate-300'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-inherit font-mono text-xs">
                <span className="font-bold">待办清单 (共 {todos.length} 项，待处理 {pendingTodos.length} 项)</span>
                <span className="text-slate-400">点击方块直接切换状态</span>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 font-mono text-xs">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => onToggleTodo(todo.id)}
                    className={`p-2.5 border flex items-center justify-between transition-colors cursor-pointer select-none ${
                      todo.completed
                        ? 'bg-black/10 border-inherit line-through text-slate-500 opacity-60'
                        : theme.isDark
                        ? 'bg-[#1a1d2c] hover:bg-[#222538] border-[#31354a] text-slate-100'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center ${
                        todo.completed ? 'bg-black text-white' : 'border-slate-400 bg-transparent'
                      }`}>
                        {todo.completed && <CheckCircle className="w-3 h-3" />}
                      </div>
                      <span className="font-sans">{todo.title}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 border border-inherit uppercase">
                      {todo.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MOBILE UNIAPP MOCK VIEW */}
      {currentPlatform === 'mobile-uniapp' && (
        <div className={`border p-6 flex flex-col items-center justify-center ${
          theme.isDark ? 'bg-[#0b0c12] border-[#242738]' : 'bg-slate-200 border-slate-300'
        }`}>
          {/* Mobile phone mock frame (Sharp rectangular phone frame) */}
          <div className="w-full max-w-sm border-2 border-black bg-black p-2 shadow-2xl">
            {/* Screen */}
            <div className={`border overflow-hidden flex flex-col h-[520px] font-sans ${
              theme.isDark ? 'bg-[#12131c] text-slate-100' : 'bg-white text-slate-900'
            }`}>
              {/* Mobile Status Bar */}
              <div className="bg-black text-white px-3 py-1 flex items-center justify-between text-[11px] font-mono select-none">
                <span>09:41</span>
                <span className="font-bold">UniApp (iOS / Android)</span>
                <span>100% ⚡</span>
              </div>

              {/* Header */}
              <div className="p-3 border-b border-inherit flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs font-mono">CROSS-TODO MOBILE</h4>
                  <p className="text-[10px] text-slate-400 font-mono">UniApp Vue3 Composition API</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-black text-white font-mono font-bold">
                  {pendingTodos.length} 待办
                </span>
              </div>

              {/* Mobile Todo Scroll List */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto text-xs">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => onToggleTodo(todo.id)}
                    className={`p-2.5 border flex items-center justify-between transition-all cursor-pointer ${
                      todo.completed
                        ? 'bg-black/5 opacity-50 line-through'
                        : theme.isDark ? 'bg-[#181a26] border-[#313548]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center ${
                        todo.completed ? 'bg-black text-white' : 'border-slate-400'
                      }`}>
                        {todo.completed && '✓'}
                      </div>
                      <span className="truncate max-w-[180px]">{todo.title}</span>
                    </div>
                    <span className="text-[9px] px-1 py-0.2 border border-inherit font-mono uppercase">
                      {todo.priority}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile Bottom AI bar */}
              <div className="p-2 border-t border-inherit bg-inherit flex items-center gap-1.5 font-mono text-xs">
                <input
                  type="text"
                  readOnly
                  value="点击上方 AI 助手直接下达指令..."
                  className="flex-1 px-2 py-1 border border-inherit bg-black/5 text-[10px] text-slate-400"
                />
                <button
                  type="button"
                  className="px-2 py-1 bg-black text-white text-[10px] font-bold"
                >
                  AI
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs font-mono text-slate-400">
            支持一键编译打包为 iOS IPA、Android APK 及微信/支付宝小程序
          </p>
        </div>
      )}

      {/* 3. ARCHITECTURE CODE SPEC VIEW */}
      {currentPlatform === 'architecture' && (
        <div className={`border overflow-hidden ${
          theme.isDark ? 'bg-[#0d0e14] border-[#292c3e]' : 'bg-white border-slate-300'
        }`}>
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-inherit bg-black/10 px-4 py-2 font-mono text-xs">
            <div className="flex items-center gap-1">
              {[
                { id: 'rust', label: '1. Rust 桌面端源码 (src-tauri)' },
                { id: 'uniapp', label: '2. UniApp 移动端代码 (Vue 3)' },
                { id: 'rest', label: '3. RESTful API 规范' },
                { id: 'sqlite', label: '4. 本地离线 SQLite Schema' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveCodeTab(t.id as any)}
                  className={`px-3 py-1 border transition-colors cursor-pointer ${
                    activeCodeTab === t.id
                      ? 'bg-black text-white font-bold border-black'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={copyCurrentCode}
              className="flex items-center gap-1 px-2 py-1 border border-slate-600 hover:border-slate-400 text-xs text-slate-300 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? '已复制' : '复制代码'}</span>
            </button>
          </div>

          {/* Code Viewer */}
          <div className="p-4 font-mono text-xs overflow-x-auto bg-[#08090d] text-cyan-300 leading-relaxed max-h-96">
            <pre>
              {activeCodeTab === 'rust' && RUST_CODE}
              {activeCodeTab === 'uniapp' && UNIAPP_CODE}
              {activeCodeTab === 'rest' && REST_SPEC}
              {activeCodeTab === 'sqlite' && SQLITE_SCHEMA}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
