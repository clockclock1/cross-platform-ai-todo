import React, { useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, CornerDownLeft, History, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIActionResponse } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AIAssistantBarProps {
  onExecutePrompt: (prompt: string) => Promise<AIActionResponse | null>;
  isLoading: boolean;
  lastAIResult: AIActionResponse | null;
}

const QUICK_PROMPTS = [
  { label: '+ 明天下午3点开会 (高优)', prompt: '帮我添加待办：明天下午3点跟团队开产品评审会，高优先级，分类属于工作' },
  { label: '✓ 把开会的待办标记完成', prompt: '把关于开会的待办标记为完成' },
  { label: '📋 安排今日3件事', prompt: '帮我安排今天的三项待办：1.提交周报 2.回复客户邮件 3.傍晚去健身房' },
  { label: '🧹 清理所有已完成待办', prompt: '清理所有已完成的待办事项' },
  { label: '⚡ 买咖啡设为紧急', prompt: '把购买咖啡豆的待办优先级设为紧急，并加上生活标签' },
];

export const AIAssistantBar: React.FC<AIAssistantBarProps> = ({
  onExecutePrompt,
  isLoading,
  lastAIResult,
}) => {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<Array<{ prompt: string; result: AIActionResponse; time: string }>>([]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentPrompt = input.trim();
    setInput('');
    const result = await onExecutePrompt(currentPrompt);
    if (result) {
      setHistoryLogs(prev => [
        { prompt: currentPrompt, result, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
        ...prev.slice(0, 9),
      ]);
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className={`w-full border p-4 sm:p-5 transition-all ${
      theme.isDark 
        ? 'bg-[#12141d] border-[#2e3146] text-slate-100' 
        : 'bg-white border-slate-300 text-slate-900 shadow-xs'
    }`}>
      {/* Header title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 border flex items-center justify-center font-mono text-xs font-bold ${
            theme.isDark ? 'bg-cyan-950/60 border-cyan-500 text-cyan-400' : 'bg-black border-black text-white'
          }`}>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-tight flex items-center gap-2">
              <span>GEMINI AI 自然语言智能指令引擎</span>
              <span className={`text-[10px] px-1.5 py-0.2 border font-mono ${
                theme.isDark ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                NATURAL CONVERSATION
              </span>
            </h2>
          </div>
        </div>

        {historyLogs.length > 0 && (
          <button
            id="toggle-ai-history-btn"
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs font-mono flex items-center gap-1 px-2 py-1 border transition-colors cursor-pointer ${
              theme.isDark 
                ? 'border-[#33374e] text-slate-400 hover:text-cyan-400 hover:bg-[#1a1d2c]' 
                : 'border-slate-300 text-slate-600 hover:text-black hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>执行日志 ({historyLogs.length})</span>
          </button>
        )}
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-slate-400 font-mono text-xs select-none">
            &gt;
          </div>
          <input
            id="ai-prompt-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="对 AI 说：明天下午3点开会 / 把写周报设为完成 / 清理已完成待办..."
            disabled={isLoading}
            className={`w-full pl-8 pr-24 py-2.5 border text-xs sm:text-sm font-mono focus:outline-none transition-all ${
              theme.isDark
                ? 'bg-[#181a26] border-[#373a50] text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
            }`}
          />
          <div className="absolute right-1.5 flex items-center">
            <button
              id="ai-submit-btn"
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`px-3 py-1.5 border text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                theme.isDark
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400'
                  : 'bg-black hover:bg-neutral-800 text-white border-black'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>解析中</span>
                </>
              ) : (
                <>
                  <span>执行</span>
                  <CornerDownLeft className="w-3 h-3 opacity-80" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Prompt Chips (Sharp rectangular tags) */}
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar font-mono">
        <span className="text-slate-400 text-[10px] uppercase shrink-0 font-bold">快捷示例:</span>
        {QUICK_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickPrompt(item.prompt)}
            className={`shrink-0 px-2 py-1 border text-[11px] transition-all cursor-pointer ${
              theme.isDark
                ? 'bg-[#181a26] hover:bg-[#222536] text-slate-300 border-[#2f3246] hover:border-cyan-500/60'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 hover:border-black'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Live AI Feedback Alert Banner */}
      <AnimatePresence>
        {lastAIResult && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mt-3 p-3 border flex items-start gap-2.5 text-xs font-mono ${
              theme.isDark
                ? 'bg-[#151928] border-cyan-500/70 text-cyan-100'
                : 'bg-blue-50/90 border-blue-300 text-blue-950'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${theme.isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
            <div className="flex-1 min-w-0">
              <div className="font-bold flex items-center gap-2">
                <span>{lastAIResult.message}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-black text-white font-mono uppercase">
                  {lastAIResult.action}
                </span>
              </div>
              <p className="opacity-80 mt-0.5 leading-relaxed text-[11px] font-sans">
                {lastAIResult.explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && historyLogs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-inherit overflow-hidden font-mono"
          >
            <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
              <span>RECENT AI DISPATCH LOGS</span>
              <button
                type="button"
                onClick={() => setHistoryLogs([])}
                className="text-slate-400 hover:text-rose-400 transition-colors"
              >
                清空日志
              </button>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs">
              {historyLogs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2 border flex items-center justify-between ${
                    theme.isDark ? 'bg-[#171924] border-[#292c3d]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-500 text-[10px]">{log.time}</span>
                    <span className="truncate">"{log.prompt}"</span>
                  </div>
                  <span className={`text-[11px] shrink-0 font-bold ${theme.isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                    {log.result.message}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
