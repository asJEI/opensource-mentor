# Cloudflare 生产部署

生产路径：GitHub `main` → 自动构建 → Cloudflare Workers（含 Static Assets）。

腾讯云 VPS + Docker 仍可用作 fallback，见 [DEPLOY.md](./DEPLOY.md)。

## 生产 URL

- Worker：`https://opensource-mentor.316920080dd.workers.dev`
- Account ID：`b4c747bf0cff2cd690256565c0f1a38c`
- Worker name（须与 `wrangler.jsonc` 的 `name` 一致）：`opensource-mentor`

## 本地脚本

| 命令 | 用途 |
|------|------|
| `npm run dev` | Vite + Worker 本地开发 |
| `npm run build` | Typecheck + 生产构建 |
| `npm run typecheck` | 仅类型检查 |
| `npm run deploy` | 构建并 `wrangler deploy` |
| `npm run preview` | 本地预览构建产物 |
| `npm run cf-typegen` | 生成 Worker 类型 |

## 自动部署（二选一，推荐先做 A）

### A. GitHub Actions（可选）

工作流：[`.github/workflows/deploy-cloudflare.yml`](./.github/workflows/deploy-cloudflare.yml)

1. 在 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) 创建 Token
   - 模板：**Edit Cloudflare Workers**（或 Custom：Workers Scripts Edit + Account Read）
2. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | `b4c747bf0cff2cd690256565c0f1a38c` |

3. `git push origin main`（或手动 **Actions → Deploy Cloudflare Worker → Run workflow**）
4. 在 Actions 中确认 job 成功；访问生产 URL 的前端与 `/api/health`

### B. Workers Builds（Cloudflare 原生 Git 绑定）

Dashboard 一次性授权 GitHub App 后，push 由 Cloudflare 直接构建：

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **opensource-mentor** → **Settings** → **Builds** → **Connect**
2. 授权 Cloudflare GitHub App，选择仓库 `asJEI/opensource-mentor`
3. 建议配置：

| 项 | 值 |
|----|-----|
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/`（仓库根） |

> Worker 仪表盘名称必须与 `wrangler.jsonc` 的 `name` 一致，否则 Builds 会失败。

若 A、B 同时启用，每次 push 会部署两次；稳定后只保留一种。

## 生产 Secrets 清单（运行时）

**不要**写入仓库、`wrangler.jsonc` 的 `vars`、或 GitHub Actions Secrets（除非你刻意把构建与运行时分开管理）。

在本机或 CI 外执行：

```bash
npx wrangler secret put PLATFORM_LLM_API_KEY
npx wrangler secret put PLATFORM_GITHUB_TOKEN
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
```

也可在 Dashboard → Worker → **Settings** → **Variables and Secrets** 添加类型为 Secret 的项。

| Secret | 必填 | 说明 |
|--------|------|------|
| `PLATFORM_LLM_API_KEY` | 平台模式推荐 | 平台默认 LLM（如 DeepSeek） |
| `PLATFORM_GITHUB_TOKEN` | 推荐 | 提高 GitHub API 限额；无则公共限流更紧 |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub 登录必需 | GitHub OAuth App 的 Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub 登录必需 | GitHub OAuth App 的 Client Secret |
| `SUPABASE_URL` | 用户持久化必需 | Supabase Project URL，仅 Worker 使用 |
| `SUPABASE_SECRET_KEY` | 用户持久化必需 | Supabase Secret Key，仅 Worker 使用，禁止返回前端 |

非密钥默认（已在 `wrangler.jsonc` → `vars`）：

- `GITHUB_API_BASE_URL`
- `DEFAULT_LLM_PROVIDER` / `DEFAULT_LLM_MODEL` / `DEFAULT_LLM_BASE_URL`
- `LLM_TIMEOUT_MS`

平台 AI 限流已通过 `wrangler.jsonc` 的 `PLATFORM_AI_RATE_LIMITER` 原生绑定配置为每个客户端每分钟 40 次，部署时会随 Worker 配置一并生效，无需创建额外 Secret。BYOK 请求不消耗平台额度。

用户 BYOK（浏览器偏好设置）经请求头传入，**永不**存为 Worker Secret。

本地对应文件：复制 `.dev.vars.example` → `.dev.vars`（已 gitignore）。

## 验收清单

- [ ] GitHub Actions Secrets 已配置，或 Workers Builds 已 Connect
- [ ] `git push origin main` 触发成功部署
- [ ] 生产前端可打开，`/api/health` 正常
- [ ] `PLATFORM_*` 已按需配置（不含真实值进 Git）
- [ ] 连续请求已验证平台 AI 限流返回 `429`
- [ ] Docker / `DEPLOY.md` 仍保留作 fallback

## 手动部署

```bash
npm ci
npm run deploy
```

需本机已 `npx wrangler login`。
