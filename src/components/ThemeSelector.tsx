import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ThemeId } from '../types';

export const ThemeSelector: React.FC = () => {
  const { themeId, theme, setTheme, themesList } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="theme-selector-trigger"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-mono transition-all cursor-pointer select-none ${
          theme.isDark 
            ? 'bg-[#181a24] hover:bg-[#222534] border-[#32354a] text-slate-200' 
            : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
        }`}
        title="切换界面主题 (无圆角多套极简配色)"
      >
        <span className="w-3 h-3 border border-black/30 inline-block" style={{ backgroundColor: theme.previewAccent }} />
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-sans">{theme.name}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1 w-64 border shadow-2xl z-50 p-1.5 animate-in fade-in duration-100 ${
            theme.isDark
              ? 'bg-[#12141c] border-[#33374d] text-slate-100'
              : 'bg-white border-slate-400 text-slate-900'
          }`}
        >
          <div className="px-2.5 py-1.5 border-b border-inherit mb-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>主题调色板 (THEMES)</span>
            <span className="text-[10px] uppercase">{themesList.length} STYLES</span>
          </div>

          <div className="space-y-1">
            {themesList.map((t) => {
              const isSelected = t.id === themeId;
              return (
                <button
                  key={t.id}
                  id={`theme-option-${t.id}`}
                  type="button"
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 text-left border transition-all cursor-pointer ${
                    isSelected
                      ? theme.isDark
                        ? 'bg-[#1f2333] border-cyan-500/80 text-white font-medium'
                        : 'bg-slate-100 border-blue-600 text-slate-900 font-medium'
                      : theme.isDark
                      ? 'border-transparent hover:bg-[#181a26] text-slate-300'
                      : 'border-transparent hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Swatch */}
                    <div
                      className="w-5 h-5 border border-black/30 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: t.previewBg }}
                    >
                      <div className="w-2.5 h-2.5" style={{ backgroundColor: t.previewAccent }} />
                    </div>
                    <div>
                      <div className="text-xs flex items-center gap-1.5">
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.subName}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className={`w-3.5 h-3.5 ${theme.isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
