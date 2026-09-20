import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Calendar, Clock, Tag, Flag, AlertCircle } from 'lucide-react';
import { TodoItem, Priority } from '../types';
import { useTheme } from '../context/ThemeContext';

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (todoData: Partial<TodoItem>) => void;
  initialTodo?: TodoItem | null;
  categories: string[];
}

export const AddEditModal: React.FC<AddEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTodo,
  categories,
}) => {
  const { theme } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('工作');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (initialTodo) {
      setTitle(initialTodo.title || '');
      setDescription(initialTodo.description || '');
      setPriority(initialTodo.priority || 'medium');
      setCategory(initialTodo.category || '工作');
      setDueDate(initialTodo.dueDate || '');
      setDueTime(initialTodo.dueTime || '');
      setTagsInput((initialTodo.tags || []).join(', '));
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory(categories[0] || '工作');
      setDueDate(new Date().toISOString().split('T')[0]);
      setDueTime('18:00');
      setTagsInput('');
    }
  }, [initialTodo, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      tags,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className={`w-full max-w-lg border shadow-2xl overflow-hidden ${
          theme.isDark
            ? 'bg-[#12141e] border-[#31354c] text-slate-100'
            : 'bg-white border-slate-400 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-inherit bg-inherit">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-black flex items-center justify-center text-white text-xs font-mono font-bold">
              {initialTodo ? 'ED' : 'NEW'}
            </div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-tight">
              {initialTodo ? '修改待办事项 (EDIT TASK)' : '新建待办事项 (CREATE TASK)'}
            </h3>
          </div>
          <button
            id="close-add-edit-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white border border-transparent hover:border-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              待办标题 (TITLE) <span className="text-rose-500">*</span>
            </label>
            <input
              id="todo-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：准备下周一架构评审 PPT"
              className={`w-full px-3 py-2 border text-sm font-mono focus:outline-none ${
                theme.isDark
                  ? 'bg-[#181a26] border-[#373a50] text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
              }`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              详细描述与执行备忘 (DESCRIPTION)
            </label>
            <textarea
              id="todo-description-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加相关上下文、链接或补充说明..."
              className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none resize-none ${
                theme.isDark
                  ? 'bg-[#181a26] border-[#373a50] text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
              }`}
            />
          </div>

          {/* Priority & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Flag className="w-3 h-3" />
                <span>优先级级别 (PRIORITY)</span>
              </label>
              <select
                id="todo-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                  theme.isDark
                    ? 'bg-[#181a26] border-[#373a50] text-slate-100 focus:border-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              >
                <option value="low">低 LOW</option>
                <option value="medium">中 MEDIUM</option>
                <option value="high">高 HIGH</option>
                <option value="urgent">紧急 URGENT</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>所属分类 (CATEGORY)</span>
              </label>
              <select
                id="todo-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                  theme.isDark
                    ? 'bg-[#181a26] border-[#373a50] text-slate-100 focus:border-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>截止日期 (DUE DATE)</span>
              </label>
              <input
                id="todo-duedate-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                  theme.isDark
                    ? 'bg-[#181a26] border-[#373a50] text-slate-100 focus:border-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>具体时间 (DUE TIME)</span>
              </label>
              <input
                id="todo-duetime-input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                  theme.isDark
                    ? 'bg-[#181a26] border-[#373a50] text-slate-100 focus:border-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600'
                }`}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              自定义标签 (TAGS，使用逗号分隔)
            </label>
            <input
              id="todo-tags-input"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="会议, 重要, 客户, 研发"
              className={`w-full px-3 py-2 border text-xs font-mono focus:outline-none ${
                theme.isDark
                  ? 'bg-[#181a26] border-[#373a50] text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
              }`}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-inherit flex items-center justify-end gap-2">
            <button
              id="cancel-add-edit-btn"
              type="button"
              onClick={onClose}
              className={`px-4 py-2 border text-xs font-mono transition-colors cursor-pointer ${
                theme.isDark
                  ? 'border-[#33374e] text-slate-300 hover:bg-[#1f2233]'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              取消 (ESC)
            </button>
            <button
              id="submit-add-edit-btn"
              type="submit"
              className={`px-4 py-2 border text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                theme.isDark
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400'
                  : 'bg-black hover:bg-neutral-800 text-white border-black'
              }`}
            >
              {initialTodo ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{initialTodo ? '保存修改' : '确认添加待办'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
