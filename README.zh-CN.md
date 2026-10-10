# OpenSource Mentor

[English](./README.md) | 简体中文

> 面向开源新手的 AI 贡献导师：理解项目、筛选 Issue、规划学习路径，并辅助完成代码审查与 Pull Request。

## 在线体验

也可通过本地 MCP 与 Skill 在 Agent 中调用项目功能，详见 [MCP 通用安装教程](./docs/mcp-hosts.zh-CN.md)（Codex、Claude Code、Cursor、DeepSeek Harness 等），或 [本地开发说明](./docs/agent-installation.zh-CN.md)。

无需本地克隆的 HTTPS 接入方案见 [Remote MCP MVP 说明](./docs/remote-mcp.zh-CN.md)。该独立 Worker 需要运营者部署，网页目前不会默认启用此端点。

- Cloudflare Workers：[https://hokkai.top](https://hokkai.top/)

在线版本与 Docker 自托管方案使用同一套前端和核心业务能力：

- Cloudflare 版本由 Worker 提供 API，并托管前端静态资源。
- Docker 版本由 Nginx 托管前端，Express 提供 API。

## 主要功能

- **中英双语**：首次访问按浏览器首选语言选择中文或英文；在顶部语言菜单切换，选择保存在当前浏览器的用户偏好中。AI 新生成内容遵循当前语言，代码、技术标识和 Issue 原文保持不变。

- **仓库分析**：提取项目定位、技术栈、目录结构和贡献切入点。
- **Issue 推荐与解释**：结合用户经验筛选任务，并用 AI 解释需求和实现方向。
- **学习路线**：围绕目标仓库生成分阶段学习与贡献计划。
- **AI 导师**：针对当前仓库、技术和开源协作流程提供问答。
- **PR 生成**：根据 Issue 与仓库上下文生成 PR 标题和描述。
- **AI 代码审查**：读取真实 GitHub Pull Request 与 diff，返回结构化问题、风险和修改建议；LLM 不可用时使用确定性规则审查，不随机生成结果。
- **GitHub 登录**：通过最小权限 OAuth 完成身份认证后立即进入产品，不阻塞在仓库扫描或画像生成上。
- **开发者画像**：登录后后台读取公开头像、仓库、语言、PR / Issue 等信息，再生成结构化能力判断；生成过程中可在设置页查看进度。
- **BYOK**：可在设置页使用自己的 GitHub Token 和兼容 OpenAI API 的模型配置，密钥仅保留在当前页面内存中。

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Zustand |
| Cloudflare 后端 | Workers、Static Assets |
| Docker 后端 | Express、Node.js、Nginx |
| 外部服务 | GitHub REST API、OpenAI-compatible LLM API |
| 测试 | Vitest、TypeScript |

```text
Browser
  ├─ Cloudflare: Static Assets + /api/* Worker
  └─ Docker: Nginx + /api/* Express
                         │
                         ├─ GitHub API
                         └─ LLM Provider

Worker ─────┐
           ├─ shared/core/code-review
Express ────┘
```

Worker 与 Express 保留不同的运行时适配层，代码审查等可复用逻辑放在 `shared/core`，避免两套实现继续分叉。

## 本地开发

### 环境要求

- Node.js 22
- npm

### Cloudflare Worker 模式

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

默认访问地址由 Vite 输出，通常为 `http://localhost:5173`。没有平台密钥时仍可打开界面，但真实 AI 与 GitHub 请求可能受模型配置和 GitHub 匿名限流影响。

本地平台密钥写入 `.dev.vars`：

```dotenv
PLATFORM_GITHUB_TOKEN=
PLATFORM_LLM_API_KEY=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SESSION_SECRET=
```

非密钥默认配置位于 [wrangler.jsonc](./wrangler.jsonc)。用户在设置页填写的 BYOK 配置不应写入服务端环境文件。

### Express 模式

```bash
npm install
npm --prefix server install
cp server/.env.example server/.env
npm --prefix server run dev
```

Express 默认监听 `http://localhost:3001`，主要用于 Docker 路径；当前 Vite 开发服务器使用 Cloudflare Worker，不再代理到 Express。

## 配置说明

推荐使用以下服务端变量：

| 变量 | 用途 |
| --- | --- |
| `PLATFORM_GITHUB_TOKEN` | 提高 GitHub API 请求限额 |
| `PLATFORM_LLM_API_KEY` | 平台默认 LLM 密钥 |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App 的 Client Secret |
| `SUPABASE_URL` | Supabase Project URL，仅 Worker 服务端使用 |
| `SUPABASE_SECRET_KEY` | Supabase 服务端 Secret Key，仅 Worker 服务端使用 |
| `SESSION_SECRET` | 独立的会话签名密钥，不得与 Supabase Key 复用 |
| `DEFAULT_LLM_PROVIDER` | 默认模型提供方 |
| `DEFAULT_LLM_BASE_URL` | OpenAI-compatible API 地址 |
| `DEFAULT_LLM_MODEL` | 默认模型 |
| `LLM_TIMEOUT_MS` | LLM 请求超时 |

真实密钥只能放在以下位置：

- 本地 Worker：`.dev.vars`
- Cloudflare 生产环境：Wrangler Secret 或 Dashboard Secret
- Express：`server/.env`
- Docker Compose：根目录 `.env`

不要提交上述本地环境文件，也不要使用 `VITE_*` 暴露平台密钥。

## Docker 部署

```bash
cp .env.docker.example .env
docker compose up -d --build
```

默认通过 `http://服务器地址:8082` 访问。完整步骤和故障排查见 [DEPLOY.md](./DEPLOY.md)。

## Cloudflare 部署

```bash
npm ci
npm run deploy
```

项目也包含 GitHub Actions 自动部署工作流。Secrets、自动部署和生产检查见 [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md)。

## 进度存储

Cloudflare Worker 路径支持登录用户将仓库、贡献指南、聊天、PR 草稿及代码审查进度保存到 Supabase，按账号和贡献任务隔离。浏览器保留恢复缓存及待同步队列，版本冲突需显式选择；访客继续使用本地进度。Express 路径尚未接入此账号存储。

数据库迁移、当前验证结果和部署后验收步骤见 [服务端存储实现说明](./docs/storage-implementation-2026-10-06.md)。

## 开发校验

```bash
npm test
npm run typecheck
npm run typecheck:server
npm run build
npm --prefix server run build
```

## 目录结构

```text
opensource-mentor/
├─ src/
│  ├─ components/          # 通用与业务组件
│  ├─ pages/               # 页面及页面私有组件
│  ├─ services/            # 前端 API 服务
│  ├─ store/               # Zustand 状态
│  └─ types/               # 前端类型
├─ worker/                 # Cloudflare Worker 路由与运行时适配
├─ server/                 # Express 后端
├─ shared/core/            # 两种后端共享的纯业务逻辑
├─ public/                 # 静态资源
├─ .github/workflows/      # Cloudflare 自动部署
├─ wrangler.jsonc          # Worker 配置
├─ docker-compose.yml      # Docker 编排
├─ DEPLOY.md               # Docker / 腾讯云部署
└─ DEPLOY-CLOUDFLARE.md    # Cloudflare 部署
```

## 安全说明

- BYOK 密钥保留在当前页面内存中，并按请求传递；服务端不持久化用户密钥。
- 平台模式只使用服务端预设的模型和 API 地址；客户端不能覆盖平台请求目标，避免平台密钥被转发到非预期地址。
- 平台 AI 请求默认按客户端限制为每分钟 10 次；BYOK 使用用户自己的额度，不占用平台配额。
- 平台密钥不得写入仓库、前端环境变量或 URL。生产环境还应配置 HTTPS、来源控制和日志脱敏。

## 项目定位

OpenSource Mentor 的目标不是替代开发者完成贡献，而是降低理解陌生仓库和参与社区协作的门槛。AI 输出可能不完整或不准确，提交代码前仍应阅读仓库贡献规范并人工核验建议。

Agent 首次画像可保存到本机；用户同意浏览器授权后，可将确认的画像同步到网页账号。详见[画像引导与账号同步](./docs/mcp-onboarding.zh-CN.md)。
