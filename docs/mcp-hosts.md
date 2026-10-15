# MCP installation across Agents and harnesses

English | [简体中文](./mcp-hosts.zh-CN.md)

OpenSource Mentor supports a local **stdio MCP server** and a hosted **Streamable HTTP MCP server**. Compatible remote hosts can connect without cloning; see [browser OAuth setup](./remote-mcp-oauth.md). The npm package has not been published, so `npx opensource-mentor-mcp` is not an available installation method. The local instructions below require Node.js 20+ and Git.

| Host capability | Connection method |
| --- | --- |
| Streamable HTTP with OAuth | Hosted URL and browser authorization |
| Streamable HTTP with custom headers, without OAuth | Operator-issued personal static credential; see [non-OAuth setup](./remote-mcp-oauth.md#hosts-without-oauth) |
| stdio | Clone the repository, install MCP dependencies and configure Node |

The source for Remote OAuth is on `codex/remote-mcp-oauth`; a default clone of `main` may still contain the earlier stdio-only guide until that branch is merged. The deployed remote service is independent of the branch a local clone uses.

## Common installation

```bash
git clone https://github.com/asJEI/opensource-mentor.git
cd opensource-mentor
npm run mcp:install
npm run test:mcp
```

On Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`. Existing checkout: run `git pull --ff-only` with a clean working tree instead of cloning again. Install only MCP dependencies; frontend installation/build is not required for the online API.

Use `node /absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs` as the local launch command. The host starts it automatically; do not run it in a separate terminal. Replace all paths below. For online operation set `OSM_BASE_URL=https://hokkai.top`; for local development set `http://localhost:5173` and start the web project separately. The website API origin is distinct from the remote MCP endpoint: `https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp`.

## Common environment

| Variable | Example / meaning |
| --- | --- |
| `OSM_BASE_URL` | `https://hokkai.top` (online website API) |
| `OSM_LOCALE` | `en-US` or `zh-CN` |
| `OSM_MODEL_SOURCE` | `website` (default) or `agent` |
| `OSM_AI_PROVIDER` | `deepseek` for direct DeepSeek API |
| `OSM_AI_MODEL` | `deepseek-flash`; check current provider model availability |
| `OSM_AI_BASE_URL` | `https://api.deepseek.com` |
| `OSM_AI_KEY` | The current user's own API key; configure locally |
| `OSM_GITHUB_TOKEN` | Optional GitHub token to raise query limits |

Credentials in the examples are placeholders. Keep real credentials in user-local configuration or host credential facilities, never in shared project configuration or chat. The configured website receives BYOK credentials to perform its model calls; use an origin you trust. Website errors do not automatically switch to the host model. Browser model settings and sign-in cookies are not imported.

## JSON hosts: Cursor, Claude Desktop and others

Merge this into the host's supported MCP configuration. For Cursor use `~/.cursor/mcp.json` globally or `.cursor/mcp.json` for one project. Claude Desktop uses its desktop MCP configuration; do not confuse it with Claude Code configuration. Other JSON hosts may need different wrapper keys; adapt according to their docs.

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"],
      "env": {
        "OSM_BASE_URL": "https://hokkai.top",
        "OSM_LOCALE": "en-US",
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

Windows: `args` may use `D:/opensource-mentor/packages/mentor-mcp/src/stdio.mjs`; if Node is not on the host PATH use `C:/Program Files/nodejs/node.exe` as `command`. Reload the connection and enable the server. In Cursor use Agent chat and approve requested tool calls according to your preferences. [Cursor MCP docs](https://prod.cursor.com/docs/mcp).

## Codex

Merge into user `~/.codex/config.toml` (Windows: `%USERPROFILE%/.codex/config.toml`):

```toml
[mcp_servers.opensource-mentor]
command = "node"
args = ["/absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs"]
tool_timeout_sec = 240

[mcp_servers.opensource-mentor.env]
OSM_BASE_URL = "https://hokkai.top"
OSM_LOCALE = "en-US"
OSM_MODEL_SOURCE = "website"
OSM_AI_PROVIDER = "deepseek"
OSM_AI_MODEL = "deepseek-flash"
OSM_AI_BASE_URL = "https://api.deepseek.com"
OSM_AI_KEY = "YOUR_OWN_API_KEY"
```

Restart/reload Codex and check the MCP tool list. [Codex MCP docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Claude Code

Register the local process without a secret in shell history:

```bash
claude mcp add --scope user --transport stdio opensource-mentor -- node /absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs
claude mcp get opensource-mentor
```

Then add the common environment values to that server's `env` in the user MCP entry (`~/.claude.json` for Claude Code). Preserve other entries. Use `/mcp` inside Claude Code to check/reconnect. For project-scoped installation `.mcp.json` uses the JSON example above, but keep real keys out of tracked project files. [Claude Code MCP docs](https://code.claude.com/docs/en/mcp).

## DeepSeek Harness

For the official `deepseek-ai/deepseek-harness`, add one `@deepseek-ai/dsh-mcp-client` entry to the profile you use. In a **`cordis.patch.yml` patch layer**, adding a new plugin requires `insert:` as below. A bare `id:` patch updates an existing entry; it does not add a missing one and may only produce a warning. A base plugin list uses bare entries instead: do not apply the patch wrapper to that format.

The installed DSH 44.0.0 bridge `0.2.0-rc.2` supports stdio and HTTP custom headers, but has no configured OAuth provider. Use local stdio below or a personal static credential for remote HTTP, not an unauthenticated remote URL. This limitation is version-specific.

```yaml
- insert:
    - id: mcp-opensource-mentor
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: opensource-mentor
        transport: stdio
        command: node
        args: ['/absolute/path/opensource-mentor/packages/mentor-mcp/src/stdio.mjs']
        toolCallTimeoutMs: 240000
        env:
          OSM_BASE_URL: https://hokkai.top
          OSM_LOCALE: en-US
          OSM_MODEL_SOURCE: agent
```

This key-free example explicitly selects the host model: generation returns `awaiting_host` context for DSH to synthesize. For website generation, set `OSM_MODEL_SOURCE: website` and configure your provider/model and `OSM_AI_KEY` in `env`, for example `OSM_AI_KEY: !!js process.env.OSM_AI_KEY`. The bridge scrubs ambient secrets before merging explicit `env`; setting a key only in the parent environment is insufficient. Never put real keys in tracked profile files.

The bridge exposes tools named `mcp__opensource-mentor__<tool>`. This DSH version supports in-place profile reload; check the tools after editing, and reconnect/restart if your version does not reload. Follow the [official MCP bridge reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md) for your version. Third-party products with the same name may differ.

## Optional Skill

MCP tools work without installing a Skill: ask the host to use OpenSource Mentor tools explicitly. To add the mentor workflow, install/copy `skills/opensource-mentor` into a supported Skill directory:

| Host | Example local directory / invocation |
| --- | --- |
| Codex | `.agents/skills/opensource-mentor`, `$opensource-mentor` |
| Cursor | `.cursor/skills/opensource-mentor`, select via `/` |
| Claude Code | `.claude/skills/opensource-mentor`, `/opensource-mentor` |
| Other harness | Its supported Skill loader; if unavailable, use MCP tool instructions |

Installing a Skill does not register MCP or copy browser credentials. DeepSeek Harness Skill discovery varies by profile/version and is not assumed here. See [Cursor Skills](https://prod.cursor.com/docs/skills), [Codex Skills](https://learn.chatgpt.com/docs/build-skills), and [Claude Code Skills](https://code.claude.com/docs/en/skills).

## Verify in any host

1. Confirm 17 tools appear.
2. Ask: "Use OpenSource Mentor `get_repository` to fetch `asJEI/opensource-mentor`; do not substitute another search tool."
3. Ask: "Use `analyze_repository`, `modelSource: website`, `locale: en-US`, for `asJEI/opensource-mentor`; report errors without switching models."
4. Ask for recommendations with your technologies, experience and time budget. Then test `modelSource: agent` explicitly and confirm the generation source is reported.

AI calls use your provider balance. Errors such as `AUTH_REQUIRED` usually mean the MCP key was not passed, `401` may indicate an invalid key, and provider errors need balance/model/base URL checks. GitHub limits may require a personal GitHub token. Hosts can have shorter tool timeouts than model generation; adjust the host's supported timeout setting. Host-model review context covers a bounded diff, not guaranteed full-repository analysis.

Compatibility status: local MCP protocol and Codex usage have been tested. Remote Codex OAuth login and profile retrieval succeeded with 17 tools. DSH 44.0.0 / bridge 0.2.0-rc.2 local discovery, repository retrieval and host-model context were reported successful; this does not establish automatic remote OAuth or end-to-end website generation. Cursor remote login remains unresolved in the recorded test. No contribution-progress synchronization, automatic GitHub publication or npm registry release is included.

[Onboarding, GitHub account connection and profile sync](./mcp-onboarding.md)
