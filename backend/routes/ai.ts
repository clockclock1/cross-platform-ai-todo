import { Router } from 'express';
import { authRequired, getAuthUser } from '../auth.js';
import { executeAiTodoAction } from '../ai-service.js';
import { allowRequest } from '../rate-limit.js';

const router = Router();

router.post('/todo-action', authRequired, async (req, res) => {
  try {
    const auth = getAuthUser(req);
    if (!allowRequest(`ai:${auth.id}`, 30, 60 * 60_000)) {
      return res.status(429).json({ success: false, error: 'AI 调用过于频繁，请稍后再试' });
    }
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ success: false, error: '请输入有效指令' });
    if (prompt.length > 1000) {
      return res.status(400).json({ success: false, error: '指令过长，请控制在 1000 字以内' });
    }
    const result = await executeAiTodoAction(auth.id, prompt);
    res.json(result);
  } catch {
    res.status(500).json({ success: false, error: 'AI 处理失败' });
  }
});

export default router;
