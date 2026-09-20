import React, { useState } from 'react';
import { Check, Calendar, Tag, Trash2, Edit2, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TodoItem, Priority } from '../types';
import { useTheme } from '../context/ThemeContext';

interface TodoItemRowProps {
  todo: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: TodoItem) => void;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; darkClass: string; lightClass: string }> = {
  urgent: {
    label: '紧急 URGENT',
    darkClass: 'bg-rose-950/60 text-rose-300 border-rose-800',
    lightClass: 'bg-rose-100 text-rose-900 border-rose-400 font-bold',
  },
  high: {
    label: '高 HIGH',
    darkClass: 'bg-amber-950/60 text-amber-300 border-amber-800',
    lightClass: 'bg-amber-100 text-amber-900 border-amber-400 font-bold',
  },
  medium: {
    label: '中 MEDIUM',
    darkClass: 'bg-blue-950/60 text-blue-300 border-blue-800',
    lightClass: 'bg-blue-100 text-blue-900 border-blue-400',
  },
  low: {
    label: '低 LOW',
    darkClass: 'bg-slate-900 text-slate-400 border-slate-700',
    lightClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export const TodoItemRow: React.FC<TodoItemRowProps> = ({
  todo,
  onToggle,
  onDelete,
  onEdit,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const priorityStyle = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG.medium;

  // Due date relative calculation
  const getDueDateLabel = () => {
    if (!todo.dueDate) return null;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    if (todo.dueDate === today) {
      return { text: '今天到期', isUrgent: !todo.completed, label: `${todo.dueDate} ${todo.dueTime || ''}` };
    }
    if (todo.dueDate === tomorrow) {
      return { text: '明天到期', isUrgent: false, label: `${todo.dueDate} ${todo.dueTime || ''}` };
    }
    if (todo.dueDate < today && !todo.completed) {
      return { text: '已逾期 OVERDUE', isOverdue: true, label: `${todo.dueDate} ${todo.dueTime || ''}` };
    }
    return { text: todo.dueDate, isUrgent: false, label: `${todo.dueDate} ${todo.dueTime || ''}` };
  };

  const dueInfo = getDueDateLabel();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`group relative border transition-all ${
        todo.completed
          ? theme.isDark 
            ? 'bg-[#10121a]/80 border-[#242738] opacity-60' 
            : 'bg-slate-50 border-slate-200 opacity-65'
          : theme.isDark
          ? 'bg-[#131520] hover:bg-[#171926] border-[#2c3044] hover:border-cyan-500/60'
          : 'bg-white hover:bg-slate-50/80 border-slate-300 hover:border-black shadow-2xs'
      }`}
    >
      <div className="p-3 sm:p-3.5 flex items-start gap-3">
        {/* Square Sharp Checkbox */}
        <button
          id={`todo-toggle-${todo.id}`}
          type="button"
          onClick={() => onToggle(todo.id)}
          className={`mt-0.5 w-4.5 h-4.5 border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            todo.completed
              ? theme.isDark
                ? 'bg-emerald-500 border-emerald-400 text-black'
                : 'bg-black border-black text-white'
              : theme.isDark
              ? 'border-[#4a4f6d] hover:border-cyan-400 bg-transparent'
              : 'border-slate-400 hover:border-black bg-white'
          }`}
          aria-label={todo.completed ? '标记为未完成' : '标记为已完成'}
        >
          {todo.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span
                onClick={() => onToggle(todo.id)}
                className={`text-xs sm:text-sm font-medium leading-snug cursor-pointer select-none transition-colors block ${
                  todo.completed
                    ? 'line-through text-slate-500'
                    : theme.isDark
                    ? 'text-slate-100 group-hover:text-cyan-300'
                    : 'text-slate-900 group-hover:text-black'
                }`}
              >
                {todo.title}
              </span>
            </div>

            {/* Quick Actions (Desktop Hover / Mobile Visible) */}
            <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                id={`edit-todo-${todo.id}`}
                type="button"
                onClick={() => onEdit(todo)}
                className={`p-1 border transition-colors cursor-pointer ${
                  theme.isDark
                    ? 'border-[#33374d] text-slate-400 hover:text-white hover:bg-[#202334]'
                    : 'border-slate-300 text-slate-600 hover:text-black hover:bg-slate-100'
                }`}
                title="编辑待办"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                id={`delete-todo-${todo.id}`}
                type="button"
                onClick={() => onDelete(todo.id)}
                className={`p-1 border transition-colors cursor-pointer ${
                  theme.isDark
                    ? 'border-rose-900/60 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50'
                    : 'border-rose-300 text-rose-600 hover:text-rose-800 hover:bg-rose-50'
                }`}
                title="删除待办"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tags and Badges (Sharp rectangular chips) */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-mono">
            {/* Priority badge */}
            <span
              className={`inline-flex items-center px-1.5 py-0.2 border text-[10px] uppercase ${
                theme.isDark ? priorityStyle.darkClass : priorityStyle.lightClass
              }`}
            >
              {priorityStyle.label}
            </span>

            {/* Category tag */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 border text-[10.5px] ${
              theme.isDark ? 'bg-[#1b1e2c] text-slate-300 border-[#353950]' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}>
              <Tag className="w-2.5 h-2.5 opacity-60" />
              <span>{todo.category}</span>
            </span>

            {/* Due Date tag */}
            {dueInfo && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 border text-[10.5px] ${
                  dueInfo.isOverdue
                    ? 'bg-rose-950/60 text-rose-400 border-rose-800 font-bold'
                    : dueInfo.isUrgent
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                    : theme.isDark
                    ? 'bg-[#181a26] text-slate-300 border-[#2f334a]'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                title={dueInfo.label}
              >
                {dueInfo.isOverdue ? (
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                ) : (
                  <Calendar className="w-2.5 h-2.5 opacity-60" />
                )}
                <span>{dueInfo.text}</span>
                {todo.dueTime && <span className="text-[9.5px] opacity-75">{todo.dueTime}</span>}
              </span>
            )}

            {/* Additional tags */}
            {todo.tags
              ?.filter((t) => t !== todo.category)
              .map((tag, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center px-1.5 py-0.2 border text-[10px] ${
                    theme.isDark
                      ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  #{tag}
                </span>
              ))}

            {/* Description toggle if description exists */}
            {todo.description && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-auto text-[10.5px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <span>{isExpanded ? '收起详情' : '详情'}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Expanded Description */}
          <AnimatePresence>
            {isExpanded && todo.description && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2.5 pt-2.5 border-t border-inherit text-xs leading-relaxed overflow-hidden font-sans"
              >
                <div className={`p-2.5 border font-mono text-xs ${
                  theme.isDark ? 'bg-[#0d0e14] border-[#242738] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  {todo.description}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
