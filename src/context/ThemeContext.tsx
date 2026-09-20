import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeId } from '../types';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subName: string;
  icon: string;
  previewBg: string;
  previewAccent: string;
  isDark: boolean;
  // CSS styling tokens (All strict rounded-none sharp edges)
  canvasBg: string;
  panelBg: string;
  headerBg: string;
  cardBg: string;
  subtleBg: string;
  inputBg: string;
  borderColor: string;
  dividerColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBg: string;
  accentHoverBg: string;
  accentText: string;
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
  tagBg: string;
  codeBg: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'sharp-light': {
    id: 'sharp-light',
    name: '瑞士极简白',
    subName: 'Swiss Minimal Light',
    icon: '☀️',
    previewBg: '#f8fafc',
    previewAccent: '#2563eb',
    isDark: false,
    canvasBg: 'bg-slate-100',
    panelBg: 'bg-white',
    headerBg: 'bg-white/95 border-b border-slate-300',
    cardBg: 'bg-white',
    subtleBg: 'bg-slate-50',
    inputBg: 'bg-slate-50',
    borderColor: 'border-slate-300',
    dividerColor: 'border-slate-200',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    textMuted: 'text-slate-400',
    accentBg: 'bg-blue-600',
    accentHoverBg: 'hover:bg-blue-700',
    accentText: 'text-white',
    accentBorder: 'border-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    tagBg: 'bg-slate-100 text-slate-700 border-slate-300',
    codeBg: 'bg-slate-900 text-slate-100',
  },
  'sharp-dark': {
    id: 'sharp-dark',
    name: '黑曜石极客',
    subName: 'Cyber Obsidian OLED',
    icon: '🌑',
    previewBg: '#090a0f',
    previewAccent: '#06b6d4',
    isDark: true,
    canvasBg: 'bg-[#090a0f]',
    panelBg: 'bg-[#12131a]',
    headerBg: 'bg-[#0e0f15]/95 border-b border-[#262836]',
    cardBg: 'bg-[#12131a]',
    subtleBg: 'bg-[#181a24]',
    inputBg: 'bg-[#161722]',
    borderColor: 'border-[#2a2c3d]',
    dividerColor: 'border-[#1f212d]',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    textMuted: 'text-slate-500',
    accentBg: 'bg-cyan-500',
    accentHoverBg: 'hover:bg-cyan-400',
    accentText: 'text-slate-950 font-bold',
    accentBorder: 'border-cyan-500',
    badgeBg: 'bg-cyan-950/60',
    badgeText: 'text-cyan-400 border border-cyan-800/60',
    tagBg: 'bg-[#1e202d] text-slate-300 border-[#32354a]',
    codeBg: 'bg-[#07070b] text-cyan-300',
  },
  'sharp-slate': {
    id: 'sharp-slate',
    name: '钛金冷灰工坊',
    subName: 'Titanium Studio Slate',
    icon: '⚙️',
    previewBg: '#1e222a',
    previewAccent: '#38bdf8',
    isDark: true,
    canvasBg: 'bg-[#181b20]',
    panelBg: 'bg-[#21252d]',
    headerBg: 'bg-[#1d2027]/95 border-b border-[#333946]',
    cardBg: 'bg-[#21252d]',
    subtleBg: 'bg-[#282d37]',
    inputBg: 'bg-[#1a1d23]',
    borderColor: 'border-[#383f4e]',
    dividerColor: 'border-[#2d333f]',
    textPrimary: 'text-[#f1f5f9]',
    textSecondary: 'text-[#94a3b8]',
    textMuted: 'text-[#64748b]',
    accentBg: 'bg-sky-500',
    accentHoverBg: 'hover:bg-sky-400',
    accentText: 'text-slate-950 font-semibold',
    accentBorder: 'border-sky-500',
    badgeBg: 'bg-sky-950/60',
    badgeText: 'text-sky-300 border border-sky-800',
    tagBg: 'bg-[#2a303c] text-slate-300 border-[#3c4454]',
    codeBg: 'bg-[#121418] text-sky-200',
  },
  'sharp-amber': {
    id: 'sharp-amber',
    name: '黑客琥珀终端',
    subName: 'Retro Amber Terminal',
    icon: '⚡',
    previewBg: '#12100d',
    previewAccent: '#f59e0b',
    isDark: true,
    canvasBg: 'bg-[#0d0c0a]',
    panelBg: 'bg-[#171510]',
    headerBg: 'bg-[#14120e]/95 border-b border-[#38301e]',
    cardBg: 'bg-[#171510]',
    subtleBg: 'bg-[#221e16]',
    inputBg: 'bg-[#13110c]',
    borderColor: 'border-[#3d331f]',
    dividerColor: 'border-[#2b2416]',
    textPrimary: 'text-amber-100',
    textSecondary: 'text-amber-300/70',
    textMuted: 'text-amber-500/50',
    accentBg: 'bg-amber-500',
    accentHoverBg: 'hover:bg-amber-400',
    accentText: 'text-slate-950 font-bold',
    accentBorder: 'border-amber-500',
    badgeBg: 'bg-amber-950/70',
    badgeText: 'text-amber-400 border border-amber-800/80',
    tagBg: 'bg-[#262016] text-amber-200 border-[#4a3d24]',
    codeBg: 'bg-[#080705] text-amber-400',
  },
  'sharp-navy': {
    id: 'sharp-navy',
    name: '深海极光蓝',
    subName: 'Deep Navy Aurora',
    icon: '🌊',
    previewBg: '#09101f',
    previewAccent: '#3b82f6',
    isDark: true,
    canvasBg: 'bg-[#060b17]',
    panelBg: 'bg-[#0c1529]',
    headerBg: 'bg-[#091122]/95 border-b border-[#1c2e55]',
    cardBg: 'bg-[#0c1529]',
    subtleBg: 'bg-[#121f3b]',
    inputBg: 'bg-[#091020]',
    borderColor: 'border-[#1e325c]',
    dividerColor: 'border-[#162544]',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-500',
    accentBg: 'bg-blue-500',
    accentHoverBg: 'hover:bg-blue-400',
    accentText: 'text-white font-semibold',
    accentBorder: 'border-blue-500',
    badgeBg: 'bg-blue-950/70',
    badgeText: 'text-blue-300 border border-blue-800',
    tagBg: 'bg-[#152445] text-blue-200 border-[#243a6c]',
    codeBg: 'bg-[#04070e] text-blue-300',
  },
  'sharp-monochrome': {
    id: 'sharp-monochrome',
    name: '工业包豪斯黑白',
    subName: 'Bauhaus Industrial Stark',
    icon: '🏛️',
    previewBg: '#f4f4f5',
    previewAccent: '#000000',
    isDark: false,
    canvasBg: 'bg-[#e4e4e7]',
    panelBg: 'bg-white',
    headerBg: 'bg-white border-b-2 border-black',
    cardBg: 'bg-white',
    subtleBg: 'bg-[#f4f4f5]',
    inputBg: 'bg-white',
    borderColor: 'border-black border-2',
    dividerColor: 'border-black/20',
    textPrimary: 'text-black',
    textSecondary: 'text-neutral-700',
    textMuted: 'text-neutral-400',
    accentBg: 'bg-black',
    accentHoverBg: 'hover:bg-neutral-800',
    accentText: 'text-white font-bold',
    accentBorder: 'border-black',
    badgeBg: 'bg-black text-white',
    badgeText: 'text-white font-bold',
    tagBg: 'bg-white text-black border border-black',
    codeBg: 'bg-black text-white',
  },
};

interface ThemeContextType {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  themesList: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('cross_todo_theme_id');
    return (saved && THEMES[saved as ThemeId]) ? (saved as ThemeId) : 'sharp-light';
  });

  const setTheme = (id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem('cross_todo_theme_id', id);
  };

  const theme = THEMES[themeId] || THEMES['sharp-light'];
  const themesList = Object.values(THEMES);

  return (
    <ThemeContext.Provider value={{ themeId, theme, setTheme, themesList }}>
      <div className={`${theme.canvasBg} ${theme.textPrimary} min-h-screen transition-colors duration-150`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
