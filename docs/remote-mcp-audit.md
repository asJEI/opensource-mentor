# Remote MCP architecture audit

## Conclusion / 结论

No large refactor is required. Use an **independent Worker** with shared tool
definitions and profile-session logic, and separate persistence adapters.
无需大规模重构：复用工具和画像会话逻辑，使用独立 Worker 和隔离的存储适配器。

| Area | Finding / 决策 |
| --- | --- |
| Existing MCP | 17 tools, SDK stdio transport, Node filesystem ProfileStore. Local filesystem state cannot be shared by remote users. |
| Business API | MentorClient already wraps the website API and agent-context generation. Reuse it with request-local credentials. |
| Authentication | Website GitHub OAuth and signed website sessions differ from remote authentication. Browser-approved scoped profile grants can be reused without forwarding website cookies. |
| Profile sync | Existing developer_profiles storage and profile APIs remain unchanged; no Supabase migration or direct database access is introduced. |
| Existing Worker /mcp option | Would share website routing, auth middleware, deployment, and platform key bindings; a transport bug could affect the website. |
| Independent Worker option | Adds an isolated deployment and Durable Object state, but leaves production website configuration and authentication untouched. Chosen for smaller blast radius. |
| Shared implementation | tools.mjs and ProfileSession are platform-neutral; stdio keeps its Node persistence adapter, remote gets per-principal Durable Objects. |
| HTTP transport | SDK Web Standard stateless Streamable HTTP, JSON responses, fresh server/client per request, no shared auth/session cache. |
| Cost protection | Public read tools only for anonymous callers; scoped personal tokens for profiles/generation; BYOK-only website generation; atomic per-user daily and concurrency budgets plus IP rate limiting. |
| High-risk deferred work | Full MCP OAuth, remote website PR review requiring account-ownership guarantees, automated credential issuance. No changes to production auth or database policies. |

See [English operation guide](remote-mcp.md) / [中文操作说明](remote-mcp.zh-CN.md)
for the tool permission matrix, protocol limitations, consent flow, and rollout.
