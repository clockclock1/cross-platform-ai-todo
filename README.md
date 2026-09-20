# AI 跨平台待办 · Cross-Platform AI Todo

[![CI](https://github.com/clockclock1/cross-platform-ai-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/clockclock1/cross-platform-ai-todo/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

简洁的跨平台待办应用，支持 **Web (React)**、**桌面端 (Rust + Tauri 2)**、**移动端 (UniApp iOS/Android)**。前后端分离，同账号全平台数据同步，内置 Gemini AI 自然语言操作待办。

仓库地址：[https://github.com/clockclock1/cross-platform-ai-todo](https://github.com/clockclock1/cross-platform-ai-todo)

---

## 功能概览

| 模块 | 能力 |
|------|------|
| 待办 | CRUD、分类、优先级、标签、截止日期、筛选排序、分页 |
| AI | 自然语言添加 / 完成 / 删除 / 批量清理（Gemini + 本地规则兜底） |
| 账号 | 邮箱注册、验证码、忘记密码、JWT 可吊销会话 |
| 管理 | 用户审核、注册策略、SMTP 发信、设备管理、数据备份导入导出 |
| 多端 | Web Cookie 鉴权；桌面 / 移动端 Bearer Token |

---

## 技术架构

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Web React  │  │ Tauri Rust  │  │ UniApp Vue3 │
│  Vite + TW  │  │  desktop/   │  │   mobile/   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │  HTTPS / REST
                        ▼
              ┌─────────────────────┐
              │  Express + TypeScript │
              │  server.ts + backend/ │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  SQLite (WAL)       │
              │  data/app.db        │
              └─────────────────────┘
```

### 后端

- **运行时**：Node.js 22 + Express 4 + TypeScript (tsx)
- **存储**：SQLite WAL（`better-sqlite3` 风格封装于 `backend/db.ts`）
- **鉴权**：JWT（`jti` 会话表可吊销）+ HttpOnly Cookie（Web）/ Bearer Token（桌面、移动端）
- **安全**：Helmet、CORS 白名单、100KB 请求体上限、bcrypt 密码、IP/账号限流
- **邮件**：Nodemailer，支持网易 / 微软 / Resend
- **AI**：`@google/genai` Gemini API，失败时本地正则兜底解析

### Web 前端

- React 19 + TypeScript + Tailwind CSS 4 + Vite 6
- `src/lib/api.ts` 统一请求；`AuthContext` 管理登录态
- 开发模式 Vite 代理 `/api` → 后端；生产模式由 Express 托管 `dist/`

### 桌面端

- Rust + **Tauri 2**（Windows / macOS / Linux）
- 静态 UI 在 `desktop/ui/`，Rust 侧 HTTP 调用后端 API
- 系统托盘、全局快捷键插件

### 移动端

- UniApp Vue 3（`mobile/`），需 HBuilderX 或 uni-cli 本地编译
- **CI 不包含 UniApp 构建**（需本地或自有流水线）

---

## 项目结构

```
├── server.ts              # Express 入口（支持 API_ONLY 纯 API 模式）
├── backend/               # 鉴权、SQLite 存储、邮件、AI、限流
├── src/                   # React Web 前端
├── desktop/               # Tauri 桌面端
│   └── src-tauri/         # Rust 工程
├── mobile/                # UniApp 移动端
├── scripts/               # 开发脚本、flow-test 冒烟测试
├── Dockerfile             # 生产容器镜像
└── .github/workflows/     # CI / Release / Docker
```

---

## 快速开始（开发）

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

**推荐：前后端分离启动**

```bash
# 终端 1 · 后端 API（3001）
npm run dev:api

# 终端 2 · 前端 Vite（5173，/api 代理到 3001）
npm run dev:web
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |
| 健康检查 | http://localhost:3001/api/health |

**Windows 双击脚本**：`启动-后端.bat` / `启动-前端.bat` / `启动-全部.bat`

**默认管理员**：邮箱见 `ADMIN_EMAIL`（默认 `admin@aitodo.local`）。若未设置 `ADMIN_PASSWORD`，首次启动随机密码写入 `data/bootstrap-admin.txt`（控制台不打印）。登录后若 `mustChangePassword=true` 须先改密。

---

## 部署方式

### 1. 传统 Node 部署（单机）

```bash
npm ci
npm run build
export NODE_ENV=production
export HOST=0.0.0.0
export PORT=3000
export JWT_SECRET="至少24位随机字符串"
export CORS_ORIGINS="https://your-domain.com"
mkdir -p data
node dist/server.cjs
```

或使用 `npm start`（需已 `npm run build`）。

**Nginx 反向代理示例**：

```nginx
server {
    listen 443 ssl;
    server_name todo.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

部署时在 `.env` 设置 `TRUST_PROXY=1`，以便限流与设备 IP 记录正确。

### 2. PM2 进程守护

```bash
npm ci && npm run build
pm2 start dist/server.cjs --name ai-todo \
  --env production \
  -o logs/out.log -e logs/err.log
pm2 save
```

环境变量可通过 `ecosystem.config.cjs` 或服务器级 `export` 注入。

### 3. Docker / GHCR 镜像

**本地构建运行**：

```bash
docker build -t ai-todo:local .
docker run -d --name ai-todo \
  -p 3000:3000 \
  -e JWT_SECRET="your-long-random-secret" \
  -e CORS_ORIGINS="http://localhost:3000" \
  -v ai-todo-data:/app/data \
  ai-todo:local
```

**GitHub Release 自动推送**（见下方 CI）：发布 Release 后，镜像地址为：

```
ghcr.io/clockclock1/cross-platform-ai-todo:latest
ghcr.io/clockclock1/cross-platform-ai-todo:<tag>
```

```bash
docker pull ghcr.io/clockclock1/cross-platform-ai-todo:latest
docker run -d -p 3000:3000 -v ai-todo-data:/app/data \
  -e JWT_SECRET="..." ghcr.io/clockclock1/cross-platform-ai-todo:latest
```

数据持久化目录：`/app/data`（SQLite `app.db`、JWT 密钥文件等）。

### 4. 前后端分离部署

| 组件 | 命令 / 说明 |
|------|-------------|
| API 服务 | `API_ONLY=1 PORT=3001 node dist/server.cjs` |
| 静态前端 | `vite build` 后将 `dist/` 部署到 CDN / Nginx |
| 环境变量 | `VITE_API_PROXY` 改为生产 API 域名；或 Nginx 将 `/api` 反代到后端 |

### 5. 桌面端分发

发布 GitHub **Release** 后，`build-binaries.yml` 自动构建并附件：

- `ai-todo-desktop-windows-amd64` / `arm64`
- `ai-todo-desktop-linux-amd64` / `arm64`
- `ai-todo-desktop-macos-amd64` / `arm64`

本地开发：

```bash
cd desktop/src-tauri
cargo tauri dev
```

### 6. 移动端（UniApp）

使用 HBuilderX 或 `@dcloudio/uni-cli` 打开 `mobile/`，配置后端 API 基址后编译 iOS/Android。**无 GitHub Actions 构建**。

---

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `GEMINI_API_KEY` | Gemini AI 密钥（可选） | 空 |
| `HOST` | 监听地址 | 开发 `0.0.0.0`，生产建议 `0.0.0.0` |
| `PORT` | 端口 | `3000`（`API_ONLY=1` 时常用 `3001`） |
| `NODE_ENV` | `production` 启用静态资源 + 严格 CSP | `development` |
| `API_ONLY` | `1` 仅 API，不托管前端 | 未设置 |
| `JWT_SECRET` | JWT 签名密钥（生产必设 ≥24 字符） | 写入 `data/jwt-secret` |
| `ADMIN_EMAIL` | 初始管理员邮箱 | `admin@aitodo.local` |
| `ADMIN_PASSWORD` | 初始管理员密码 | 随机生成 |
| `CORS_ORIGINS` | 逗号分隔白名单 | 见 `.env.example` |
| `TRUST_PROXY` | `1` 信任反向代理头 | `0` |
| `APP_URL` | 应用对外 URL（邮件链接等） | `http://localhost:5173` |

完整示例见 [`.env.example`](.env.example)。

---

## CI / Release 工作流

与 [Failover-Proxy](https://github.com/clockclock1/Failover-Proxy/tree/main/.github/workflows) 同结构：

| Workflow | 触发 | 作用 |
|----------|------|------|
| [`ci.yml`](.github/workflows/ci.yml) | push / PR | Web 后端 `lint` + `build`；桌面端 `cargo check` |
| [`build-binaries.yml`](.github/workflows/build-binaries.yml) | Release published | 六平台 Tauri 桌面安装包 → Release 附件 |
| [`docker.yml`](.github/workflows/docker.yml) | Release published | 构建并推送 `ghcr.io` 多架构镜像 |

**发布桌面 / Docker 镜像**：在 GitHub 创建 Release（如 `v1.0.0`）即可触发构建。

---

## REST API 参考

**Base URL**：`http://localhost:3001`（开发 API）或你的生产域名。

**通用响应**：`{ success: boolean, error?: string, ... }`

**鉴权方式**：

| 客户端 | 方式 |
|--------|------|
| Web | 登录后 HttpOnly Cookie `aitodo_token`（`credentials: include`） |
| 桌面 / 移动 | `Authorization: Bearer <token>`（先 Web 登录或 `/api/auth/login` 带 `platform`） |

**限流**：登录、注册、验证码、AI、邮件测试等接口有 IP/用户级频率限制，超限返回 `429`。

---

### 系统

#### `GET /api/health`

健康检查，无需鉴权。

```json
{ "success": true, "status": "ok", "time": "2026-09-20T08:00:00.000Z" }
```

#### `GET /api/cross-platform/specs`

返回架构与支持平台说明，无需鉴权。

---

### 认证 `/api/auth`

#### `POST /api/auth/send-code`

发送注册验证码（防枚举：无论邮箱是否存在均返回相同提示）。

```json
// Request
{ "email": "user@example.com" }

// Response
{ "success": true, "message": "若该邮箱可以注册，验证码将发送到邮箱" }
```

#### `POST /api/auth/register`

```json
// Request
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "Passw0rd1",
  "code": "123456"
}

// Response 201（直接可用）
{ "success": true, "user": { /* PublicUser */ } }

// Response 201（待审核）
{ "success": true, "pending": true, "message": "注册成功，请等待管理员审核", "user": { ... } }
```

密码规则：≥8 位，含字母与数字。

#### `POST /api/auth/login`

```json
// Request
{
  "email": "admin@aitodo.local",
  "password": "your-password",
  "platform": "web",
  "deviceName": "Chrome",
  "clientVersion": "1.0.0"
}

// Response
{ "success": true, "user": { /* PublicUser */ }, "token": "..." }
```

- `platform` 为 `web` 或未传：设置 Cookie，响应中 **不含** `token`
- `platform` 为 `desktop-rust` / `mobile-uniapp`：响应返回 `token`，不设 Cookie

#### `POST /api/auth/logout`

需鉴权。清除 Cookie 并吊销当前会话。

#### `GET /api/auth/me`

需鉴权。返回当前用户 `PublicUser`。

#### `POST /api/auth/change-password`

需鉴权。

```json
{ "oldPassword": "...", "newPassword": "..." }
```

成功后刷新 Cookie / 会话。

#### `POST /api/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

统一成功响应，不暴露邮箱是否存在。

#### `POST /api/auth/reset-password`

```json
{ "email": "user@example.com", "code": "123456", "password": "NewPass1" }
```

#### `POST /api/auth/client-token`

需鉴权。为已登录 Web 用户签发桌面/移动端 Bearer Token。

```json
// Request
{ "platform": "desktop-rust", "deviceName": "MacBook", "clientVersion": "1.0.0" }

// Response
{ "success": true, "token": "...", "deviceId": "dev_xxx" }
```

#### `GET /api/auth/users` · 管理员

列出全部用户。

#### `PATCH /api/auth/users/:id` · 管理员

```json
{ "role": "member", "status": "active", "plan": "Standard" }
```

`role`: `admin` | `manager` | `member` | `guest`  
`status`: `active` | `pending` | `disabled`

#### `DELETE /api/auth/users/:id` · 管理员

删除用户（不可删当前登录账号；须保留至少一名 active 管理员）。

---

### 待办 `/api/todos`

全部需鉴权。数据按当前登录用户隔离。

#### `GET /api/todos`

Query 参数：

| 参数 | 说明 |
|------|------|
| `status` | `all` / `active` / `completed` |
| `category` | 分类名 |
| `priority` | `low` / `medium` / `high` / `urgent` |
| `search` | 标题关键词（≤100 字） |
| `sort` | 排序字段 |
| `page` | 页码，默认 1 |
| `pageSize` | 每页条数，默认 50 |

```json
{
  "success": true,
  "data": [ /* TodoRecord[] */ ],
  "total": 42,
  "page": 1,
  "pageSize": 50
}
```

**TodoRecord 字段**：

```typescript
{
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  tags: string[];
  dueDate: string | null;   // YYYY-MM-DD
  dueTime?: string | null;  // HH:mm
  createdAt: string;        // ISO8601
  updatedAt: string;
  completedAt?: string | null;
}
```

#### `POST /api/todos`

```json
{
  "title": "写周报",
  "description": "本周进度",
  "priority": "high",
  "category": "工作",
  "tags": ["工作"],
  "dueDate": "2026-09-25",
  "dueTime": "18:00"
}
```

#### `PUT /api/todos/:id`

部分或全量更新字段（同 POST 结构）。

#### `PATCH /api/todos/:id/toggle`

切换完成状态。

#### `DELETE /api/todos/:id`

删除单条待办。

#### `POST /api/todos/clear-completed`

清除当前用户所有已完成项。

```json
{ "success": true, "clearedCount": 3 }
```

#### `POST /api/todos/batch`

批量创建（最多 50 条）。

```json
{ "items": [ { "title": "任务 A" }, { "title": "任务 B", "priority": "low" } ] }
```

---

### AI `/api/ai`

#### `POST /api/ai/todo-action`

需鉴权。自然语言操作待办（限 1000 字，30 次/小时/用户）。

```json
// Request
{ "prompt": "明天下午三点提醒我买咖啡，优先级高" }

// Response 示例
{
  "success": true,
  "action": "ADD_TODO",
  "message": "已添加待办「买咖啡」",
  "data": { /* 新建或更新的 TodoRecord */ },
  "explanation": "..."
}
```

`action` 可能值：`ADD_TODO` | `COMPLETE_TODO` | `DELETE_TODO` | `CLEAR_COMPLETED` | `QUERY` | `UNKNOWN`

---

### 管理 / 设置 `/api`

以下路径挂载在 `/api` 下（见 `server.ts`）。

#### `GET /api/registration`

公开注册策略（无需管理员）。

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "requireEmailVerify": true,
    "requireAdminApproval": false
  }
}
```

#### `GET /api/settings` · 管理员

系统配置 + 统计。邮件密码 / Resend Key **脱敏**。

#### `PUT /api/settings` · 管理员

更新 AI、同步、分类、API、邮件、注册策略等。邮件密钥留空表示不修改原值。

#### `POST /api/mail/test` · 管理员

```json
{ "to": "admin@example.com" }
```

#### `GET /api/devices`

当前用户已登录设备列表。

#### `DELETE /api/devices/:id`

注销指定设备（吊销该设备会话）。

#### `GET /api/backup/export` · 管理员

下载 JSON 备份（待办 + 脱敏设置 + 设备）。

#### `POST /api/backup/import` · 管理员

```json
{
  "mode": "merge",
  "todos": [ /* TodoRecord-like[] */ ]
}
```

`mode`: `merge` | `overwrite`

---

## 邮件配置

管理员后台 → **邮件发件 SMTP**：

| 渠道 | 说明 |
|------|------|
| 网易 | `smtp.163.com`，使用授权码 |
| 微软 | `smtp.office365.com` |
| Resend | API Key 发信 |

生产环境须启用 SMTP；验证码 **不会** 在 API 响应中返回明文。

---

## 安全说明

- SQLite 持久化 + WAL；JWT 会话可吊销
- Web HttpOnly Cookie；桌面/移动 Bearer Token
- 登录 / 验证码 / AI / 发信限流
- 备份导出脱敏邮件密钥；CORS 白名单；Helmet；请求体 100KB
- 桌面端禁用不安全 `innerHTML` 拼接；Tauri CSP 已启用
- `data/`、`.env` 已在 `.gitignore`，**勿提交密钥与数据库**

---

## 开发脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:api` | 仅后端 API（3001） |
| `npm run dev:web` | 仅前端 Vite（5173） |
| `npm run dev:all` | 同时启动前后端 |
| `npm run dev` | 一体模式（3000） |
| `npm run build` | Vite + esbuild 生产构建 |
| `npm start` | 生产启动 |
| `npm run lint` | TypeScript 类型检查 |
| `node scripts/flow-test.mjs` | 37 项 API 冒烟测试 |

---

## License

[Apache License 2.0](LICENSE)
