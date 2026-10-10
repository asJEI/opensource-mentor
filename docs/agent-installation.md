# Use OpenSource Mentor in your Agent

English | [简体中文](./agent-installation.zh-CN.md)

For online website usage and host-specific setup across Codex, Claude Code, Cursor and DeepSeek Harness, start with the [universal MCP installation guide](./mcp-hosts.md). This page also covers local development and API details.

This repository includes a local stdio MCP server and a discoverable Agent Skill. The server calls the same API used by the website for repository analysis, Issue recommendations/explanations, learning roadmaps, mentor chat, PR drafts and reviews. GitHub search and source-context tools work independently of the website. No npm package or remote MCP endpoint has been published yet.

## Install the MCP server

Requires Node.js 20 or newer and a host that supports local stdio MCP servers.

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
npm run mcp:install
```

For a local website API, follow the main README setup and run `npm run dev` in a separate terminal. The default service origin is `http://localhost:5173`; use the actual port printed by Vite. Alternatively set `OSM_BASE_URL` to your existing HTTPS OpenSource Mentor website origin. The MCP server is a local adapter, not an HTTP endpoint at that origin.

For hosts accepting JSON MCP configuration, merge this entry into their existing configuration. Replace the absolute path; do not overwrite other server entries.

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "command": "node",
      "args": ["/absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"],
      "env": {
        "OSM_BASE_URL": "http://localhost:5173",
        "OSM_LOCALE": "en-US"
      }
    }
  }
}
```

On Windows, use an absolute path such as `D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs`. Set an absolute `command` path too if your host cannot find Node.

For Codex hosts using TOML configuration:

```toml
[mcp_servers.opensource-mentor]
command = "node"
args = ["/absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"]

[mcp_servers.opensource-mentor.env]
OSM_BASE_URL = "http://localhost:5173"
OSM_LOCALE = "en-US"
```

Reload the connection and check that the 12 tools appear. Hosts without stdio support need a future remote MCP adapter; this release does not provide one.

## Configuration

Each user should configure their own model API credentials; this project does not bundle the author's shared key. Add these values to the existing `[mcp_servers.opensource-mentor.env]` table for direct DeepSeek access, then reload the connection:

```toml
OSM_MODEL_SOURCE = "website"
OSM_AI_PROVIDER = "deepseek"
OSM_AI_MODEL = "deepseek-flash"
OSM_AI_BASE_URL = "https://api.deepseek.com"
OSM_AI_KEY = "YOUR_OWN_API_KEY"
```

Flash is the lower-cost option in the current [official DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/). Check current model availability and pricing before configuring it. Other providers require their own provider/model/base URL values. Enter secrets in local configuration or host credential facilities, not chat or committed files.

### Choose the generation source

AI tools default to `modelSource: website`: generation runs through the existing website API, using the backend platform model or the MCP's BYOK configuration. Browser-local model settings are not automatically imported. A failed website call returns an error and never silently switches to the host model.

Users can say "use my Agent/harness model"; the Skill then passes `modelSource: agent`. In this mode the tool retrieves GitHub context and returns `generationStatus: awaiting_host` for the host to generate the answer. No website AI endpoint is called and no AI key is required. The MCP cannot select or change the host's model or access its subscription credentials. Source retrieval still needs network access and is subject to GitHub limits. Results are context rather than the website's generated result schema.

Set `OSM_MODEL_SOURCE` to `website` (default) or `agent` for an installation-level default. A per-tool `modelSource` overrides it. Switch in a conversation with "use the website model again". Completed website results contain `modelSource`, `generationStatus: completed`, and `result`; the Skill should disclose the generation source. Host reviews do not save a website review record and include only bounded PR patches.

| Environment variable | Purpose |
| --- | --- |
| `OSM_BASE_URL` | Website origin; default `http://localhost:5173`. HTTPS required outside localhost. No `/api` suffix. |
| `OSM_LOCALE` | Default output language; `en-US` or `zh-CN`. Per-tool locale takes precedence. |
| `OSM_MODEL_SOURCE` | Default generation source: `website` or `agent`. |
| `OSM_GITHUB_TOKEN` | Optional user GitHub token for direct GitHub and website GitHub requests. |
| `OSM_AI_KEY` | Optional BYOK AI key, sent through the website's existing header contract. |
| `OSM_AI_PROVIDER` | Existing backend provider identifier, default `openai`. |
| `OSM_AI_MODEL` | BYOK model identifier. |
| `OSM_AI_BASE_URL` | Optional provider API base URL supported by your backend. |

Use the host's credential facilities or local environment for secrets. Never paste secrets in prompts, Skill files or committed configuration. The configured website receives BYOK credentials for its existing upstream calls; configure only a service you trust. Redirects are rejected to prevent credential forwarding to another origin. The adapter does not read browser cookies or localStorage. Anonymous GitHub requests have lower rate limits. Website AI tools need either platform AI configuration or valid BYOK configuration; host Agent login does not configure the website's model.

## Install the Skill

Install the `skills/opensource-mentor` folder through your host's Skill installer or supported Skill directory. In Codex, ask `$skill-installer` to install that directory from this repository once these changes are available on GitHub. For testing unpushed changes, install/copy the local folder using your host's supported local Skill workflow. Installing the Skill alone does not configure MCP.

Then try:

> Use $opensource-mentor to find a beginner-friendly TypeScript project. I have five hours per week and want to make my first contribution.

Or simply:

> Can you find an open-source repository that suits me?

Implicit activation depends on host matching. Explicit invocation is available when it does not activate automatically. The Skill instructs the Agent to gather only missing preferences, search live candidates, check contribution context, explain evidence, and continue into learning guidance.

## Tools and boundaries

`search_repositories`, `get_repository`, `get_repository_context`, `list_issues`, `get_issue_context`, `analyze_repository`, `recommend_issues`, `explain_issue`, `generate_learning_plan`, `mentor_chat`, `generate_pr_draft`, `review_pull_request`.

Source documents and issue histories are bounded to keep responses manageable. Issue context reads the first 30 comments and timeline events and reports that limitation; it cannot guarantee an issue is unclaimed. Website AI matching does not replace current availability checks. Original technical content remains unchanged; generated website text follows locale.

PR drafts do not publish PRs. Reviews may save a review record on the configured service, but do not post GitHub comments. No browser-account progress synchronization or write access to the workspace is exposed. Public discovery does not require an OpenSource Mentor account. Host compatibility beyond protocol tests must be verified in each actual host.

## Verify

```bash
npm run test:mcp
npm test
npm run build
```

MCP tests cover actual initialization/tool calls over in-memory and stdio transports, schema validation, locale and API payload mapping, credential transport/redaction, discovery and issue explanation.
