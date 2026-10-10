# 在 Agent 中使用 OpenSource Mentor

[English](./agent-installation.md) | 简体中文

连接在线网页及 Codex、Claude Code、Cursor、DeepSeek Harness 的接入步骤，先看 [MCP 通用安装教程](./mcp-hosts.zh-CN.md)。本页补充本地开发及 API 配置细节。

项目提供本地 stdio MCP 与配套 Skill。Agent 可调用与网页相同的仓库分析、Issue 推荐和解释、学习路线、导师问答、PR 草稿及审查功能。仓库搜索、文档和 Issue 上下文直接读取 GitHub，无需启动网页。此版本尚未发布 npm 包或远程 MCP 地址。

## 安装 MCP

需要 Node.js 20+，以及支持本地 stdio MCP 的 Agent。

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
npm run mcp:install
```

本地使用时，按 README 配置项目，在另一个终端运行 `npm run dev`。默认 API 地址为 `http://localhost:5173`；如果 Vite 使用其他端口，应同步修改配置。也可将 `OSM_BASE_URL` 设置为已有项目网站的 HTTPS origin。这个地址是网页 API 地址，不是远程 MCP 地址。

将以下配置合并到支持 JSON MCP 配置的宿主，替换绝对路径，保留已有其他服务：

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "command": "node",
      "args": ["D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"],
      "env": {
        "OSM_BASE_URL": "http://localhost:5173",
        "OSM_LOCALE": "zh-CN"
      }
    }
  }
}
```

Codex 使用 TOML 配置时：

```toml
[mcp_servers.opensource-mentor]
command = "node"
args = ["D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"]

[mcp_servers.opensource-mentor.env]
OSM_BASE_URL = "http://localhost:5173"
OSM_LOCALE = "zh-CN"
```

重新加载 MCP 连接，确认出现 12 个工具。宿主找不到 Node 时，将 `command` 改为 Node 的绝对路径。不支持 stdio 的宿主需要后续远程 MCP 版本。

## 凭据和 AI 配置

推荐每位用户使用自己的模型 API，项目不附带作者的共享 Key。请在本机 MCP 配置的 `[mcp_servers.opensource-mentor.env]` 段填入下面的配置，不要重复创建该段，也不要将真实 Key 提交到仓库或发到对话中：

```toml
OSM_MODEL_SOURCE = "website"
OSM_AI_PROVIDER = "deepseek"
OSM_AI_MODEL = "deepseek-flash"
OSM_AI_BASE_URL = "https://api.deepseek.com"
OSM_AI_KEY = "YOUR_OWN_API_KEY"
```

这是 DeepSeek 官方直连配置；模型名称和价格以 [DeepSeek 官方文档](https://api-docs.deepseek.com/quick_start/pricing/) 为准。第三方服务应填写其对应 Provider、模型名和地址。保存后重新加载 MCP 连接。填写 Key 后沿用网页 AI 流程，但凭据来自当前用户 MCP 的配置，不来自浏览器。

AI 工具默认使用网页模型（`modelSource: website`），调用后端平台模型或 MCP 的 BYOK 配置。浏览器设置中的 DeepSeek 配置不会自动读取。网页调用失败时返回错误，不会自动改用宿主模型。

用户可以说“这次用我自己的 Agent／harness 模型”，Skill 会传入 `modelSource: agent`。MCP 只检索 GitHub 上下文，返回 `generationStatus: awaiting_host`，由当前宿主模型生成结果；无需模型 API Key，也不调用网页 AI。MCP 无法切换宿主的具体模型或读取其订阅凭据。宿主模式的返回是上下文，不是网页已生成的内容。

安装默认值可用 `OSM_MODEL_SOURCE = "website"` 或 `"agent"` 配置；单次调用参数优先。说“切回网页模型”即可在对话中切回。网页结果含 `generationStatus: completed` 与 `result`，回答应标明实际生成来源。宿主 PR 审查只读取有限的 diff，不保存网页审查记录。

- `OSM_BASE_URL`：网站 origin，不能添加 `/api`；非本地地址要求 HTTPS。
- `OSM_LOCALE`：默认 `en-US`，可设置为 `zh-CN`；调用参数的 locale 优先。
- `OSM_MODEL_SOURCE`：默认 `website`，可设为 `agent`；显式调用参数优先。
- `OSM_GITHUB_TOKEN`：可选 GitHub Token，用于直接 GitHub 查询及网页 API 查询；未配置时匿名请求限额较低。
- `OSM_AI_KEY`、`OSM_AI_PROVIDER`、`OSM_AI_MODEL`、`OSM_AI_BASE_URL`：可选 BYOK 配置，沿用网页后端已有 Provider 和请求头契约。Provider 默认 `openai`。

AI 功能需要服务端平台模型配置或有效 BYOK；宿主 Agent 已登录不意味着网站 AI 已配置。凭据通过宿主凭据设施或本地环境变量配置，不放入对话、Skill 或提交到仓库。BYOK 凭据会发送给你配置的网站以调用模型，因此只连接可信服务。适配器拒绝重定向，不读取浏览器 Cookie 或 localStorage。

## 安装 Skill 与使用

通过宿主 Skill 安装器或其支持的目录安装 `skills/opensource-mentor`。代码发布到 GitHub 后，Codex 可让 `$skill-installer` 从该仓库安装此目录；未推送版本应使用宿主支持的本地安装方式。安装 Skill 不会自动配置 MCP。

随后直接说：

> 可以给我找一个适合我的开源仓库吗？我熟悉 TypeScript，每周有五小时，想完成第一次贡献。

也可显式调用：

> 用 $opensource-mentor 帮我解释这个 Issue，并制定学习路线。

Skill 会指导 Agent 补齐必要偏好，搜索候选仓库，核对文档和 Issue，给出有证据的推荐，再继续调用项目的学习与贡献功能。自动触发取决于宿主匹配；未自动触发时用显式调用。

## 当前覆盖与边界

工具：`search_repositories`、`get_repository`、`get_repository_context`、`list_issues`、`get_issue_context`、`analyze_repository`、`recommend_issues`、`explain_issue`、`generate_learning_plan`、`mentor_chat`、`generate_pr_draft`、`review_pull_request`。

Issue 上下文最多读取前 30 条评论与时间线事件，长文有截断标记，不能保证发现所有认领或关联 PR。推荐仍需核对最新任务状态。网页生成文本遵循 locale，保留原始技术内容。

PR 草稿不会创建 PR；审查可能在配置的服务保存审查记录，但不会向 GitHub 发布评论。首版未接入网页账号进度同步，不提供工作区写入接口。公开发现无需项目账号。协议测试通过不代表所有宿主已实测兼容。

验证命令：`npm run test:mcp`、`npm test`、`npm run build`。完整配置说明见[英文安装说明](./agent-installation.md)。
