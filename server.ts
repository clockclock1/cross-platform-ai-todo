import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import authRoutes from './backend/routes/auth.js';
import todoRoutes from './backend/routes/todos.js';
import adminRoutes from './backend/routes/admin.js';
import aiRoutes from './backend/routes/ai.js';
import { getSettings } from './backend/store.js';

dotenv.config();

const API_ONLY = process.env.API_ONLY === '1' || process.argv.includes('--api-only');
const IS_PROD = process.env.NODE_ENV === 'production';

function parseCorsOrigins() {
  const fromEnv = process.env.CORS_ORIGINS || getSettings().apiConfig.corsOrigins || '';
  return fromEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || (API_ONLY ? 3001 : 3000);
  const HOST = process.env.HOST || (IS_PROD ? '127.0.0.1' : '0.0.0.0');

  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: IS_PROD
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'img-src': ["'self'", 'data:', 'https:'],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'connect-src': ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '100kb' }));

  const allowed = parseCorsOrigins();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (!allowed.length || allowed.includes('*')) {
          return cb(null, !IS_PROD);
        }
        if (allowed.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/cross-platform/specs', (_req, res) => {
    res.json({
      architecture: '前后端分离 · 多账号 JWT 鉴权 · 同账号全平台同步',
      supportedPlatforms: {
        web: { client: 'React 19 + TypeScript + Tailwind', deployment: 'Vite SPA' },
        desktop: { os: ['Windows', 'macOS', 'Linux'], runtime: 'Rust + Tauri 2.0' },
        mobile: { os: ['iOS', 'Android'], runtime: 'UniApp Vue 3' },
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/todos', todoRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api', adminRoutes);

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.message === 'Not allowed by CORS') {
      return res.status(403).json({ success: false, error: '跨域来源不被允许' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: '请求体过大' });
    }
    return next(err);
  });

  if (API_ONLY) {
    app.get('/', (_req, res) => {
      res.json({
        name: 'AI Todo API',
        mode: IS_PROD ? 'production' : 'development',
        health: '/api/health',
      });
    });
  } else if (!IS_PROD) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log('');
    console.log(`  [AI Todo] ${API_ONLY ? 'API' : 'App'} http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log('  [AI Todo] 管理员账号见环境变量 ADMIN_EMAIL；初始密码仅写入 data/bootstrap-admin.txt（若自动生成）');
    if (API_ONLY) console.log('  [AI Todo] 前端: npm run dev:web');
    console.log('');
  });
}

startServer().catch((err) => {
  console.error('[AI Todo] 启动失败', err);
  process.exit(1);
});
