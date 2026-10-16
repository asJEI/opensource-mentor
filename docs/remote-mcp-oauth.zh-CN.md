# Remote MCP：浏览器授权接入

[English](remote-mcp-oauth.md)

这是推荐的安装方式，无需 npm 账号、克隆仓库或在本机启动 MCP。客户端必须支持 Streamable HTTP 和 OAuth；仅支持本地 stdio 的客户端请使用[本地安装](mcp-hosts.zh-CN.md)。安装 MCP 不会自动安装 Skill。

## 让 Agent 帮你配置

将下面这段话发送给目标 Agent：

> 请阅读 https://github.com/asJEI/opensource-mentor 的 docs/remote-mcp-oauth.zh-CN.md，为当前客户端配置 OpenSource Mentor Remote MCP。连接地址为 https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp 。使用远程连接，无需克隆仓库或启动本地服务；保留其他 MCP 配置，不重复添加已有条目。引导我完成 OAuth 登录，然后调用 get_repository 获取 asJEI/opensource-mentor，验证连接。若当前客户端不支持远程 MCP 或 OAuth，请明确说明，不要自动改为本地安装。

Agent 需要有修改宿主配置的权限；否则在客户端 MCP 设置中手动添加地址。GitHub 登录和批准由用户在浏览器中完成。首次连接需要授权，安装成功不会自动弹出画像问卷；在首次使用时读取画像并询问缺失信息。

## 远程配置

支持 MCP OAuth 的 Agent 只需配置远程地址，不再需要个人凭证请求头：

```json
{
  "mcpServers": {
    "opensource-mentor-remote": {
      "url": "https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp"
    }
  }
}
```

## 用户流程

1. 删除旧远程条目中的 Authorization，保存配置，重新连接或点击宿主的登录/授权按钮。
2. 浏览器打开 OpenSource Mentor 授权页，显示客户端名称、返回地址和申请权限。
   客户端名称由客户端提供，请核对返回地址，只批准你刚发起的连接。
3. 点击网页链接，在新标签页登录 GitHub；若尚未登录，登录完成后返回网页批准页并刷新。
   核对连接码，选择同意或拒绝。网页沿用现有登录和批准流程。
4. 保持远程 OAuth 页面打开，它每五秒检查批准结果，自动跳回 Agent。
   不需要复制任何访问凭证。
5. 询问缺失画像，用户确认后保存；同步画像需显式确认 `sync: true`。

首次测试提示词：

> 请调用 opensource-mentor-remote 的 get_user_profile，询问缺失信息，经我确认后保存。寻找适合我第一次贡献的 TypeScript 仓库，生成建议显式使用 modelSource: agent。

使用 Agent 模型不需要 DeepSeek/OpenAI Key。网页模型仍需 byok 权限和用户自己的
X-AI-Key；OAuth 不会提供或复制平台公用模型密钥。默认授权范围为 profile agent，
需要网页模型时应重新申请包含 byok 的授权，并由宿主安全配置用户自己的模型密钥。

## 不支持 OAuth 的宿主

现有远程服务也支持运营者逐用户发放静态访问凭证。支持 Streamable HTTP 和自定义
请求头的宿主，无需手工提取 OAuth 访问令牌。这个方案仍需运营者管理，不是自助 PAT
系统；当前静态凭证没有自动过期时间，运营者移除摘要即可撤销。

DSH 44.0.0 / 桥接 0.2.0-rc.2 可在 profile 的 `cordis.patch.yml` 中加入：

```yaml
- insert:
    - id: mcp-opensource-mentor-remote
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: opensource-mentor-remote
        transport: streamable-http
        url: https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp
        headers:
          Authorization: !!js '`Bearer ${process.env.OSM_REMOTE_TOKEN}`'
        toolCallTimeoutMs: 240000
```

在启动宿主的环境中设置 OSM_REMOTE_TOKEN，或使用其私有凭证设施。HTTP 的 `headers`
与 stdio 子进程的 `env` 是不同配置。不要提交真实凭证，不同用户不能共用凭证。
当前远程初始化要求认证，该桥接只填 URL 不够。使用具有 agent 权限的凭证时，
生成工具显式选择 `modelSource: agent`。

运营者生成至少 32 字节的随机凭证，Secret REMOTE_ACCESS_TOKENS 只存其 SHA-256 摘要、
唯一稳定用户 id 和最小权限，例如 profile、agent；命令见[旧版运营者步骤](remote-mcp.zh-CN.md#部署步骤)。
更新 Secret 会替换整个注册表，必须合并已有条目后上传，否则会撤销其他用户的访问。
轮换保留该用户 id。静态凭证身份与 OAuth 网页身份不同，切换认证方式不会自动迁移画像。

OAuth access token 最长一小时，把它复制进静态请求头不是推荐方案。已有网页 device
批准接口也不等于标准 OAuth device-code grant；即使增加后者，宿主或辅助程序仍需实现
对应认证和刷新逻辑。

## 运营者发布

本次不需要新的 GitHub OAuth App、GitHub 密钥或 Supabase 表。
Remote Worker 调用既有网页 `/api/mcp/device/start`、`poll` 和 `profile` 接口完成批准。
网页画像授权凭证留在服务端，MCP 客户端只收到资源限定的 MCP 访问令牌。

```powershell
npm.cmd ci
npm.cmd run mcp:install
npm.cmd test
npm.cmd run test:mcp
npm.cmd run typecheck
npm.cmd run remote:build
npx.cmd wrangler deploy --config wrangler.remote.jsonc
```

配置新增 REMOTE_OAUTH Durable Object 和 v2 migration，保留原有 REMOTE_USERS、v1
migration、现有画像及旧个人凭证兼容性。REMOTE_ORIGIN 必须与实际远程地址一致。
REMOTE_OAUTH_REQUIRE_LOGIN=true 使初始化即触发登录，适合 Cursor 等宿主。
设置为 false 可保留匿名初始化和公开工具调用，受保护工具仍会触发 OAuth 401。
没有改变原有 stdio 安装方式和认证规则。

## 安全与兼容范围

- 资源发现、授权服务器发现、动态客户端注册（DCR）、S256 PKCE 和精确回调校验。
  客户端 ID 元数据文档（CIMD）尚未支持，仅支持 DCR 或已有 DCR 注册的公共 PKCE 客户端。
- 授权请求有效期十分钟，授权码两分钟且只能使用一次。
- 访问令牌最长一小时；刷新令牌轮换，旧刷新令牌重放会撤销整个授权族。
  授权族最长七天，不超过网页画像授权期限，到期需浏览器重新批准。
  每个授权族最多签发 200 组令牌；客户端注册保留三十天。
- `/oauth/revoke` 支持通过客户端 id 和对应令牌撤销整个授权族。
  断开画像连接只撤销网页画像访问，不等同于撤销所有 MCP 登录令牌。
- 同一网页账号在多个 Agent 中共享自己的画像；不同网页账号保持隔离。
  不按用户名推断身份，使用受网页验证的不可变账号 id。
- IP 限速与工具每日/并发额度保留。授权服务每天全局最多注册 1000 个客户端、
  发起 1000 次授权；定时清除过期授权记录。网页上游请求十秒超时。
- 浏览器流程使用 HttpOnly Cookie、同源检查和 CSRF 证明；页面禁止嵌入、引用泄漏和未授权脚本。
  运维仍应限制访问 URL 日志，避免记录回调授权码。
- 独立 OAuth Durable Object 串行处理授权操作，适合初期规模；高并发推广前需负载测试和分片。
- 自动化测试模拟 GitHub 批准结果，不代表已完成真实 Cursor/GitHub 浏览器回归。
  首次线上验证请核对登录、拒绝、画像保存、刷新和另一个账号隔离。
- 既有依赖的 9 项审计告警仍需另行处理，不能仅凭测试通过宣称已完成生产安全审计。

协议依据：[MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)。
