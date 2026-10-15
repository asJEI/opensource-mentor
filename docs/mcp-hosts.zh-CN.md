# MCP 通用安装教程

[English](./mcp-hosts.md) | 简体中文

目前支持**本地 stdio MCP**和**云端 Streamable HTTP MCP**。支持远程 OAuth 的宿主可以免克隆接入，见[浏览器授权教程](./remote-mcp-oauth.zh-CN.md)。npm 包尚未发布，暂不能使用 `npx opensource-mentor-mcp` 安装。

| 宿主能力 | 接入方式 |
| --- | --- |
| Streamable HTTP + OAuth | 远程地址与浏览器授权 |
| Streamable HTTP + 自定义请求头，无 OAuth | 运营者逐用户发放静态凭证，见[非 OAuth 宿主](./remote-mcp-oauth.zh-CN.md#不支持-oauth-的宿主) |
| stdio | 克隆仓库，安装 MCP 依赖，配置 Node 启动 |

Remote OAuth 实现与更新后的安装说明已纳入 main。线上远程服务独立于用户克隆的分支。下文主要说明本地接入。

## 1. 安装程序

需要 Node.js 20+ 和 Git。在准备放置程序的目录运行：

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
npm run mcp:install
npm run test:mcp
```

Windows PowerShell 若阻止 `npm.ps1`，用 `npm.cmd run mcp:install` 和 `npm.cmd run test:mcp`。已有仓库且工作区干净时，先运行 `git pull --ff-only`，不用再次克隆。

连接在线网页时，仅安装 MCP 依赖即可，不用构建或启动本地网页。宿主会自动启动 `node /绝对路径/opensource-mentor/packages/mentor-mcp/src/stdio.mjs`。

## 2. 通用配置

所有宿主使用同一组环境变量：

| 变量 | 示例或用途 |
| --- | --- |
| `OSM_BASE_URL` | `https://hokkai.top`，在线网页 API origin，不能添加 `/api` 或 `/mcp` |
| `OSM_LOCALE` | `zh-CN` 或 `en-US` |
| `OSM_MODEL_SOURCE` | 默认 `website`，可选 `agent` |
| `OSM_AI_PROVIDER` | DeepSeek 官方直连填 `deepseek` |
| `OSM_AI_MODEL` | `deepseek-flash`，以模型供应商当前可用模型为准 |
| `OSM_AI_BASE_URL` | `https://api.deepseek.com` |
| `OSM_AI_KEY` | 每位用户自己的 API Key，只配置在本机 |
| `OSM_GITHUB_TOKEN` | 可选，提高 GitHub 查询额度 |

示例只有占位符，不包含共享 Key。在线网页会接收 BYOK 凭据以调用模型，请只连接可信网站。浏览器里的模型配置与登录 Cookie 不会自动同步。网页失败不自动切换到 Agent 模型。

## 3. 按宿主接入

### JSON 配置：Cursor、Claude Desktop 等

将下列配置合并到宿主配置文件，保留其他服务。Cursor 全局路径为 `~/.cursor/mcp.json`（Windows：`%USERPROFILE%/.cursor/mcp.json`）；单项目路径为 `.cursor/mcp.json`。Claude Desktop 使用其桌面 MCP 配置文件，与 Claude Code 不同。其他宿主的外层字段可能不同，应按其文档适配。

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "type": "stdio",
      "command": "node",
      "args": ["D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"],
      "env": {
        "OSM_BASE_URL": "https://hokkai.top",
        "OSM_LOCALE": "zh-CN",
        "OSM_MODEL_SOURCE": "website",
        "OSM_AI_PROVIDER": "deepseek",
        "OSM_AI_MODEL": "deepseek-flash",
        "OSM_AI_BASE_URL": "https://api.deepseek.com",
        "OSM_AI_KEY": "YOUR_OWN_API_KEY"
      }
    }
  }
}
```

路径按实际安装位置替换。找不到 Node 时，Windows 的 `command` 可用 `C:/Program Files/nodejs/node.exe`。保存后重新加载连接、启用服务。Cursor 在 Agent 对话中使用工具，按宿主设置批准调用。[Cursor 官方说明](https://prod.cursor.com/docs/mcp)

### Codex

编辑用户 `~/.codex/config.toml`（Windows：`%USERPROFILE%/.codex/config.toml`），不要重复添加已有同名段：

```toml
[mcp_servers.opensource-mentor]
command = "node"
args = ["D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"]
tool_timeout_sec = 240

[mcp_servers.opensource-mentor.env]
OSM_BASE_URL = "https://hokkai.top"
OSM_LOCALE = "zh-CN"
OSM_MODEL_SOURCE = "website"
OSM_AI_PROVIDER = "deepseek"
OSM_AI_MODEL = "deepseek-flash"
OSM_AI_BASE_URL = "https://api.deepseek.com"
OSM_AI_KEY = "YOUR_OWN_API_KEY"
```

重启或重新加载 Codex，确认工具出现。[Codex 官方说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

### Claude Code

先注册本地进程，不把 Key 写入命令历史：

```bash
claude mcp add --scope user --transport stdio opensource-mentor -- node D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs
claude mcp get opensource-mentor
```

再在用户配置 `~/.claude.json` 的该服务条目中加入与 JSON 示例相同的 `env`。保留其他条目；在 Claude Code 中用 `/mcp` 检查并重连。也可使用项目 `.mcp.json`，但不能把真实 Key 提交到项目。[Claude Code 官方说明](https://code.claude.com/docs/en/mcp)

### DeepSeek Harness

针对官方 `deepseek-ai/deepseek-harness`，在当前 profile 的 **`cordis.patch.yml` 补丁层**新增插件时，需要用 `insert:` 包裹。裸 `id:` 用于修改已有条目，条目不存在时可能只输出警告、不加载工具。基础插件清单则使用裸条目，不要套用补丁层的格式。

已核对 DSH 44.0.0 内置桥接 `0.2.0-rc.2`：支持 stdio 和 HTTP 自定义请求头，但没有配置 OAuth provider。该版本应使用下方本地方案，或用独立静态凭证接入远程；只填远程 URL 无法自动登录。不能将此限制推广到所有版本。

```yaml
- insert:
    - id: mcp-opensource-mentor
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: opensource-mentor
        transport: stdio
        command: node
        args: ['D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs']
        toolCallTimeoutMs: 240000
        env:
          OSM_BASE_URL: https://hokkai.top
          OSM_LOCALE: zh-CN
          OSM_MODEL_SOURCE: agent
```

这个示例显式使用宿主模型，无需模型 API Key；生成工具返回 `awaiting_host` 上下文，由 DSH 完成生成。使用网页模型时，把 `OSM_MODEL_SOURCE` 改为 `website`，并在 `env` 配置供应商、模型及个人密钥，例如 `OSM_AI_KEY: !!js process.env.OSM_AI_KEY`。桥接先清洗父进程的密钥变量，再合并显式 `env`，所以只设置父进程密钥不够。不要把真实密钥写入被 Git 跟踪的配置。

工具会显示为 `mcp__opensource-mentor__<工具名>`。该 DSH 版本支持 profile 热更新，编辑后检查工具列表；其他版本若未更新，再重连或重启。配置规则以对应版本的[官方桥接文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)为准，同名第三方项目可能不同。

## 4. 可选安装 Skill

MCP 本身即可使用：直接要求宿主调用 OpenSource Mentor 工具。想启用完整导师流程，再将仓库的 `skills/opensource-mentor` 复制或安装到宿主支持的位置：

| 宿主 | 项目目录示例 | 显式使用 |
| --- | --- | --- |
| Codex | `.agents/skills/opensource-mentor` | `$opensource-mentor` |
| Cursor | `.cursor/skills/opensource-mentor` | 输入 `/` 选择 Skill |
| Claude Code | `.claude/skills/opensource-mentor` | `/opensource-mentor` |
| 其他 harness | 使用其 Skill 加载器 | 无加载器时直接调用 MCP 工具 |

Skill 不会自动注册 MCP，也不会复制浏览器凭据。DeepSeek Harness 的 Skill 加载受版本和 profile 影响，这里不假定自动发现。[Cursor Skills](https://prod.cursor.com/docs/skills)、[Codex Skills](https://learn.chatgpt.com/docs/build-skills)、[Claude Code Skills](https://code.claude.com/docs/en/skills)

## 5. 通用验证

1. 确认服务出现 17 个工具。
2. 发送：“用 OpenSource Mentor 的 get_repository 获取 asJEI/opensource-mentor，不要使用其他搜索工具代替。”
3. 发送：“用 analyze_repository，modelSource 指定 website、locale 指定 zh-CN，分析 asJEI/opensource-mentor；失败只报告错误，不切换模型。”
4. 发送自己的技术、经验和时间预算，测试推荐流程；再明确指定 `modelSource: agent` 验证宿主模式。

网页模型调用使用用户自己的供应商余额。`AUTH_REQUIRED` 常见于未传入 Key；供应商 `401`、额度不足、模型名或地址错误需要检查个人配置。GitHub 限流可配置个人 GitHub Token。宿主超时时应调整其支持的工具超时设置。

已验证本地协议与 Codex 使用，远程 Codex OAuth 登录和画像读取也已成功，共 17 个工具。用户报告 DSH 44.0.0 / 桥接 0.2.0-rc.2 的本地工具发现、仓库读取与宿主模型上下文调用成功，但这不代表自动远程 OAuth 或网页生成已通过。Cursor 远程登录在记录的测试中仍未解决。目前不包含贡献进度同步、自动 GitHub 发布或 npm 包发布。

[首次画像、GitHub 账号连接与同步说明](./mcp-onboarding.zh-CN.md)
