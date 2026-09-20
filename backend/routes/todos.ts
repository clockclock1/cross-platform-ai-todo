import { Router } from 'express';
import { authRequired, getAuthUser, newId } from '../auth.js';
import { getSettings } from '../store.js';
import {
  clearCompletedTodos,
  deleteTodo,
  findTodo,
  importTodos,
  insertTodo,
  queryTodos,
  updateTodo,
} from '../store.js';
import { Priority, TodoRecord } from '../types.js';

const router = Router();
router.use(authRequired);

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function asPriority(value: unknown, fallback: Priority): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : fallback;
}

function asTags(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback.slice(0, 20);
  return value.filter((t) => typeof t === 'string').map((t) => cleanText(t, 24)).filter(Boolean).slice(0, 20);
}

function buildTodo(userId: string, body: any): TodoRecord | null {
  const title = cleanText(body?.title, 200);
  if (!title) return null;
  const settings = getSettings();
  const category = cleanText(body?.category, 32) || '工作';
  const now = new Date().toISOString();
  return {
    id: newId('todo'),
    userId,
    title,
    description: cleanText(body?.description, 2000),
    completed: false,
    priority: asPriority(body?.priority, settings.ai.defaultPriority),
    category,
    tags: asTags(body?.tags, [category]),
    dueDate: body?.dueDate ? cleanText(body.dueDate, 10) : null,
    dueTime: body?.dueTime ? cleanText(body.dueTime, 5) : null,
    createdAt: now,
    updatedAt: now,
  };
}

router.get('/', (req, res) => {
  const auth = getAuthUser(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 50);
  const result = queryTodos(auth.id, {
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
    search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined,
    sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  });
  res.json({ success: true, ...result });
});

router.post('/clear-completed', (req, res) => {
  const auth = getAuthUser(req);
  const cleared = clearCompletedTodos(auth.id);
  res.json({ success: true, clearedCount: cleared.length });
});

router.post('/batch', (req, res) => {
  const auth = getAuthUser(req);
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  if (!items.length) return res.status(400).json({ success: false, error: '待办列表不能为空' });
  const created = items.map((item: any) => buildTodo(auth.id, item)).filter(Boolean) as TodoRecord[];
  if (!created.length) return res.status(400).json({ success: false, error: '没有有效的待办标题' });
  created.forEach((todo) => insertTodo(todo));
  res.status(201).json({ success: true, data: created });
});

router.post('/', (req, res) => {
  const auth = getAuthUser(req);
  const todo = buildTodo(auth.id, req.body);
  if (!todo) return res.status(400).json({ success: false, error: '标题不能为空' });
  res.status(201).json({ success: true, data: insertTodo(todo) });
});

router.put('/:id', (req, res) => {
  const auth = getAuthUser(req);
  const existing = findTodo(req.params.id, auth.id);
  if (!existing) return res.status(404).json({ success: false, error: '未找到待办' });
  const body = req.body || {};
  const title = body.title !== undefined ? cleanText(body.title, 200) : existing.title;
  if (!title) return res.status(400).json({ success: false, error: '标题不能为空' });
  const completed = body.completed !== undefined ? Boolean(body.completed) : existing.completed;
  const updated = updateTodo(existing.id, auth.id, {
    title,
    description: body.description !== undefined ? cleanText(body.description, 2000) : existing.description,
    priority: body.priority !== undefined ? asPriority(body.priority, existing.priority) : existing.priority,
    category: body.category !== undefined ? cleanText(body.category, 32) || existing.category : existing.category,
    tags: body.tags !== undefined ? asTags(body.tags, existing.tags) : existing.tags,
    dueDate: body.dueDate !== undefined ? (body.dueDate ? cleanText(body.dueDate, 10) : null) : existing.dueDate,
    dueTime: body.dueTime !== undefined ? (body.dueTime ? cleanText(body.dueTime, 5) : null) : existing.dueTime,
    completed,
    completedAt: completed ? existing.completedAt || new Date().toISOString() : null,
  });
  res.json({ success: true, data: updated });
});

router.patch('/:id/toggle', (req, res) => {
  const auth = getAuthUser(req);
  const existing = findTodo(req.params.id, auth.id);
  if (!existing) return res.status(404).json({ success: false, error: '未找到待办' });
  const completed = !existing.completed;
  const updated = updateTodo(existing.id, auth.id, {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  });
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const auth = getAuthUser(req);
  if (!deleteTodo(req.params.id, auth.id)) return res.status(404).json({ success: false, error: '未找到待办' });
  res.json({ success: true, message: '删除成功' });
});

export function importUserTodos(userId: string, items: any[], mode: 'merge' | 'overwrite') {
  const normalized = items.slice(0, 500).map((item) => {
    const built = buildTodo(userId, item);
    if (!built) return null;
    return { ...built, id: cleanText(item?.id, 80) || built.id, completed: Boolean(item?.completed) };
  }).filter(Boolean) as TodoRecord[];
  importTodos(userId, normalized, mode);
  return normalized.length;
}

export default router;
