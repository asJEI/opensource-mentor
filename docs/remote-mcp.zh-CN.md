# Remote MCP MVP

[English](remote-mcp.md) · [架构审计](remote-mcp-audit.md)

通过独立 Cloudflare Worker 的 `https://你的远程Worker/mcp` 提供现有 17 个工具，
使用无会话 Streamable HTTP。用户无需克隆仓库或启动本地进程。
**本次没有部署线上服务，也没有为 hokkai.top 增加 /mcp 路由。**

## 安装与调用

Agent 必须支持 Streamable HTTP 和自定义请求头。下面是常见配置形状，外层字段请按宿主文档调整：

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "url": "https://你的远程Worker/mcp",
      "headers": { "Authorization": "Bearer 你的个人远程凭证" }
    }
  }
}
```

匿名查询可以删除 headers。凭证由运营者逐用户发放，不要放在 URL 或对话中。
原生客户端通常不发送 Origin；浏览器客户端需要配置精确来源白名单。
MVP 尚未提供标准 MCP OAuth 发现、动态客户端注册，不支持只能使用 OAuth 的宿主。

使用 Agent 自己的模型时，生成工具显式传 `modelSource: "agent"`，返回上下文和
`awaiting_host`，随后由 Agent 生成建议。使用网页模型时，需要 `byok` 权限和
`X-AI-Key` 请求头，可选 `X-AI-Provider`（openai/deepseek）及 `X-AI-Model`。
用户密钥只在本次请求中传给远程 Worker 和受信任的网页 API。禁用自定义模型地址和平台公用 AI 密钥。

## 工具与权限

| 工具 | 权限 |
| --- | --- |
| search_repositories、get_repository、get_repository_context、get_issue_context、list_issues | 可匿名读取公开数据 |
| get_user_profile、save_user_profile、connect_account、account_connection_status、disconnect_account | 个人凭证和 profile 权限 |
| analyze_repository、recommend_issues、explain_issue、generate_learning_plan、mentor_chat、generate_pr_draft | agent 权限并显式选择 Agent 模式；或 byok 权限和用户自己的密钥 |
| review_pull_request | 仅 agent 权限和显式 Agent 模式；网页模式等待补齐账号归属校验 |

匿名可发现全部 17 个工具，但受保护工具会拒绝未认证调用。安装本身不会自动弹出问卷，
首次使用由 Agent 询问缺失画像和保存意愿。画像先保存到该用户独立的 Durable Object。
`connect_account` 提供网页批准链接，用户在自己的浏览器登录 GitHub 并批准，
Agent 用 `account_connection_status` 轮询确认。只有用户确认的画像才通过已有网页 API
同步到 Supabase。远程访问凭证、网页画像授权和 GitHub 登录各有用途，不能互相替代。
每个远程身份可绑定一个网页账号。

## 部署步骤

1. `npm ci`、`npm run mcp:install` 安装依赖。
2. 执行 `npm test`、`npm run test:mcp`、`npm run typecheck`、`npm run build`、
   `npm run remote:build`；最后一个命令仅打包预检，不发布。
3. 审查 `wrangler.remote.jsonc`，把 REMOTE_ORIGIN 改成独立 Worker 的精确 HTTPS origin，
   确认 WEBSITE_ORIGIN 是受信任的网页地址。浏览器接入可设置逗号分隔的 ALLOWED_ORIGINS，
   不能使用通配符。保留独立 Worker，不修改网页 Worker 的路由和配置。
4. 用 Node `crypto.randomBytes(32).toString('base64url')` 创建随机个人凭证，
   用 `crypto.createHash('sha256').update(token).digest('hex')` 计算摘要。
   原始凭证仅交给对应用户，以下注册表通过
   `npx wrangler secret put REMOTE_ACCESS_TOKENS --config wrangler.remote.jsonc` 保存为 Secret：

   ```json
   { "SHA256_HEX_DIGEST": { "id": "unique-user-id", "scopes": ["profile", "agent", "byok"] } }
   ```

   不要提交凭证或注册表。不同用户必须使用不同的稳定 id，重复 id 会使认证关闭。
   仅发放必要权限。移除摘要即可撤销凭证；轮换时保留该用户 id 可保留画像。
   已获授权的在途请求仍可能完成。
5. 获得部署批准后执行 `npx wrangler deploy --config wrangler.remote.jsonc`。
   migration 只创建独立 Worker 的 SQLite Durable Objects，不改 Supabase 表，
   不要求修改现有网页生产配置。确认 Cloudflare 账号支持相关绑定。
6. 公开地址前验证初始化、工具发现、匿名查询、两名用户画像隔离、拒绝无效凭证和真实浏览器授权。

本地预览：`npm run remote:dev`，地址为 `http://localhost:8787`。
用本地 Wrangler 变量/Secret 配置注册表。其他电脑上的 Agent 不能访问你的 localhost。
PowerShell 若拦截 npm.ps1，请用 npm.cmd / npx.cmd。

## 安全边界与遗留问题

- IP 限速每分钟 40 次，包含工具发现。Cloudflare 限速是近似的分布式限速，不是全局账单上限。
- 每身份每天 UTC 最多 200 次工具尝试，其中网页生成最多 20 次；最多两个并发调用。
  失败也计入额度，并发租约十分钟过期，跨 UTC 午夜保留在途租约。
- 请求体最大 128 KiB，不支持批处理、MCP Session ID、GET/SSE 订阅、断线续接或服务端采样。
- 存储身份由服务器推导，不使用调用者提供的用户 id、会话 id、IP 或共享本地文件。
  网页连接凭证保存在用户私有服务端状态中，批准凭证沿用现有流程的有效期。
- 不转发客户端 Cookie 或远程 Authorization 到网页；不转发服务端全局 AI Key。
  响应禁止缓存，代码不记录凭证；上线前仍需审查基础设施日志配置。
- 复用 stdio 的固定 SDK 版本，不保证仅支持未来协议的客户端兼容。
- 自动化测试使用真实 SDK 客户端/传输层、模拟上游 HTTP 和事务内存存储；
  仍需部署后的 Cloudflare 绑定验证和真实 GitHub 授权回归。
- 后续需要标准 MCP OAuth、自助凭证管理、网页 PR Review 归属校验、监控和负载验证。
  上线前应另行处理现有依赖审计告警。
