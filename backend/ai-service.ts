import { GoogleGenAI, Type } from '@google/genai';
import { clearCompletedTodos, deleteTodosByIds, getSettings, insertTodo, listTodosByUser, updateTodo } from './store.js';
import { newId, sortTodos } from './auth.js';
import { Priority, TodoRecord } from './types.js';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

function fallbackIntentParser(input: string, currentTodos: TodoRecord[]) {
  const text = input.trim();

  if (/清理.*(完成|已办)|删除.*(完成|已办)|clear\s*completed/i.test(text)) {
    return {
      action: 'CLEAR_COMPLETED',
      message: '已清理所有已完成的待办事项',
      explanation: '检测到清理指令，已自动删除所有已完成项。',
    };
  }

  if (/完成|勾选|做完|搞定|已做|complete|done|finish/i.test(text) && !/添加|新建|增加|创建/i.test(text)) {
    const matched = currentTodos.find((t) => {
      const titleClean = t.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      const textClean = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      return textClean.includes(titleClean) || titleClean.includes(textClean);
    });
    if (matched) {
      return {
        action: 'COMPLETE_TODO',
        targetIds: [matched.id],
        targetTitles: [matched.title],
        updates: { completed: true },
        message: `已将待办「${matched.title}」标记为完成`,
        explanation: '已根据您的指令匹配到任务并更新其完成状态。',
      };
    }
  }

  if (/删除|移除|删掉|delete|remove/i.test(text) && !/添加|新建/i.test(text)) {
    const matched = currentTodos.find((t) => text.includes(t.title));
    if (matched) {
      return {
        action: 'DELETE_TODO',
        targetIds: [matched.id],
        targetTitles: [matched.title],
        message: `已删除待办「${matched.title}」`,
        explanation: '已为您删除该待办事项。',
      };
    }
  }

  let priority: Priority = getSettings().ai.defaultPriority || 'medium';
  if (/紧急|urgent|马上|火急/i.test(text)) priority = 'urgent';
  else if (/高优先级|重要|优先|high/i.test(text)) priority = 'high';
  else if (/低优先级|顺便|闲暇|low/i.test(text)) priority = 'low';

  let category = '工作';
  if (/买|购物|超市|咖啡|生活|家务/i.test(text)) category = '生活';
  else if (/学|读|看书|复习|课程/i.test(text)) category = '学习';
  else if (/运动|健身|跑步|体检/i.test(text)) category = '健康';
  else if (/想法|灵感|创意/i.test(text)) category = '灵感';

  const today = new Date();
  let dueDate: string | null = today.toISOString().split('T')[0];
  if (/明天|tomorrow/i.test(text)) {
    dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  } else if (/后天/i.test(text)) {
    dueDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  }

  let cleanTitle = text
    .replace(/^(帮我|请|麻烦|添加|新建|创建|加一个|记得|记录|待办|任务)[:：\s]*/g, '')
    .replace(/(，|,)?(优先级[高低中]|紧急|重要|明天|今天|后天).*/g, '')
    .trim();
  if (!cleanTitle) cleanTitle = text.slice(0, 30);

  return {
    action: 'CREATE_TODO',
    createdTodos: [{ title: cleanTitle, priority, category, dueDate, tags: [category] }],
    message: `已添加待办：「${cleanTitle}」`,
    explanation: `已提取标题、${priority} 优先级和分类 [${category}] 并自动创建。`,
  };
}

function applyAiAction(userId: string, parsed: any, userTodos: TodoRecord[]) {
  const todayStr = new Date().toISOString().split('T')[0];

  const makeTodo = (item: any): TodoRecord => ({
    id: newId('todo'),
    userId,
    title: String(item.title || '').slice(0, 200),
    description: String(item.description || '').slice(0, 2000),
    completed: false,
    priority: item.priority || 'medium',
    category: item.category || '工作',
    tags: Array.isArray(item.tags) ? item.tags.filter((t: unknown) => typeof t === 'string').slice(0, 20) : [item.category || '工作'],
    dueDate: item.dueDate || todayStr,
    dueTime: item.dueTime || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if ((parsed.action === 'CREATE_TODO' || parsed.action === 'BATCH_CREATE') && parsed.createdTodos?.length) {
    const items = parsed.action === 'CREATE_TODO' ? parsed.createdTodos.slice(0, 1) : parsed.createdTodos.slice(0, 20);
    const created = items.filter((item: any) => item?.title).map((item: any) => insertTodo(makeTodo(item)));
    return { aiResult: parsed, affectedTodos: created };
  }

  if (parsed.action === 'COMPLETE_TODO') {
    const targetIds: string[] = [...(parsed.targetIds || [])];
    if (!targetIds.length && parsed.targetTitles) {
      parsed.targetTitles.forEach((title: string) => {
        const matched = userTodos.find(
          (t) => t.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(t.title.toLowerCase())
        );
        if (matched) targetIds.push(matched.id);
      });
    }
    const affected = targetIds
      .map((id) => updateTodo(id, userId, { completed: true, completedAt: new Date().toISOString() }))
      .filter(Boolean);
    return { aiResult: parsed, affectedTodos: affected };
  }

  if (parsed.action === 'DELETE_TODO') {
    const targetIds: string[] = [...(parsed.targetIds || [])];
    if (!targetIds.length && parsed.targetTitles) {
      parsed.targetTitles.forEach((title: string) => {
        const matched = userTodos.find((t) => t.title.toLowerCase().includes(title.toLowerCase()));
        if (matched) targetIds.push(matched.id);
      });
    }
    return { aiResult: parsed, affectedTodos: deleteTodosByIds(userId, targetIds) };
  }

  if (parsed.action === 'CLEAR_COMPLETED') {
    return { aiResult: parsed, affectedTodos: clearCompletedTodos(userId) };
  }

  if (parsed.action === 'UPDATE_TODO' && parsed.targetIds?.length) {
    const id = parsed.targetIds[0];
    const updates = parsed.updates || {};
    const patch: Partial<TodoRecord> = {};
    if (typeof updates.completed === 'boolean') patch.completed = updates.completed;
    if (typeof updates.priority === 'string') patch.priority = updates.priority;
    if (typeof updates.dueDate === 'string') patch.dueDate = updates.dueDate.slice(0, 10);
    if (typeof updates.category === 'string') patch.category = updates.category.slice(0, 32);
    const updated = updateTodo(id, userId, patch);
    if (updated) return { aiResult: parsed, affectedTodos: [updated] };
  }

  return { aiResult: parsed, affectedTodos: [] };
}

export async function executeAiTodoAction(userId: string, prompt: string) {
  const userTodos = sortTodos(listTodosByUser(userId));
  const client = getGeminiClient();
  const todayStr = new Date().toISOString().split('T')[0];
  const currentTimeStr = new Date().toTimeString().slice(0, 5);
  const aiSettings = getSettings().ai;

  const summary = userTodos.map((t) => ({
    id: t.id,
    title: t.title,
    completed: t.completed,
    priority: t.priority,
    category: t.category,
    dueDate: t.dueDate,
  }));

  if (client) {
    try {
      const systemInstruction = `${aiSettings.customPrompt}
当前日期: ${todayStr}, 当前时间: ${currentTimeStr}。
当前待办列表: ${JSON.stringify(summary, null, 2)}
识别意图并返回 JSON：CREATE_TODO, BATCH_CREATE, COMPLETE_TODO, DELETE_TODO, CLEAR_COMPLETED, UPDATE_TODO, QUERY_INFO。`;

      const response = await client.models.generateContent({
        model: aiSettings.model || 'gemini-2.5-flash',
        contents: prompt.trim(),
        config: {
          systemInstruction,
          temperature: aiSettings.temperature,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              message: { type: Type.STRING },
              explanation: { type: Type.STRING },
              createdTodos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    category: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    dueTime: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['title'],
                },
              },
              targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
              updates: {
                type: Type.OBJECT,
                properties: {
                  completed: { type: Type.BOOLEAN },
                  priority: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
              },
            },
            required: ['action', 'message', 'explanation'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (aiSettings.enableIntentAutoExecute) {
        const result = applyAiAction(userId, parsed, userTodos);
        return { success: true, ...result };
      }
      return { success: true, aiResult: parsed, affectedTodos: [] };
    } catch (err) {
      console.error('Gemini API error, fallback:', err);
    }
  }

  const fallback = fallbackIntentParser(prompt, userTodos);
  const result = applyAiAction(userId, fallback, userTodos);
  return { success: true, ...result };
}
