# Remote MCP MVP

[简体中文](remote-mcp.zh-CN.md) · [Architecture audit](remote-mcp-audit.md)

This MVP exposes the existing 17 tools through stateless Streamable HTTP at
`https://YOUR-REMOTE-WORKER/mcp`. It requires no repository clone on the Agent
computer. The endpoint is **not deployed by this change**. `hokkai.top/mcp` is
not the endpoint supplied by this implementation.

## Connect

Use a host that supports Streamable HTTP and custom headers. Adapt the outer
configuration to that host; this common JSON shape is illustrative:

```json
{
  "mcpServers": {
    "opensource-mentor": {
      "url": "https://YOUR-REMOTE-WORKER/mcp",
      "headers": { "Authorization": "Bearer YOUR_PERSONAL_REMOTE_TOKEN" }
    }
  }
}
```

Remove `headers` for anonymous public repository tools. Native clients normally
send no Origin; browser clients require an explicit origin allowlist. Never put
credentials in the URL or conversation. Credentials are provisioned by the
operator for this MVP. OAuth-only hosts are not supported yet: this does not
implement MCP OAuth discovery or dynamic client registration.

For host-model generation, pass `modelSource: "agent"` to a generation tool.
The result contains context and `awaiting_host`; the Agent generates the answer.
For website-model generation, the credential needs `byok` scope and the host
must send `X-AI-Key`, optionally `X-AI-Provider` (`openai` or `deepseek`) and
`X-AI-Model`. The key goes to this Worker and the trusted website API for that
request. Custom model base URLs and platform-funded generation are disabled.

## Tool permissions

| Tools | Requirement |
| --- | --- |
| search_repositories, get_repository, get_repository_context, get_issue_context, list_issues | Anonymous public reads |
| get_user_profile, save_user_profile, connect_account, account_connection_status, disconnect_account | Personal token with `profile` scope |
| analyze_repository, recommend_issues, explain_issue, generate_learning_plan, mentor_chat, generate_pr_draft | `agent` scope with explicit agent mode, or `byok` scope plus own key for website mode |
| review_pull_request | `agent` scope and explicit agent mode; remote website mode is disabled pending account-ownership enforcement |

Tool discovery is anonymous and lists all 17 tools. Installation alone cannot
open onboarding: on first use, the Agent asks for missing profile fields and
consent before saving. Profiles initially live in a private Durable Object.
`connect_account` returns a website approval link; the user signs in with GitHub
in their own browser, approves, and the Agent polls `account_connection_status`.
Only confirmed profile data is synced through the existing website profile API
to Supabase. Remote access tokens, website profile grants, and GitHub login are
distinct credentials. Each remote principal can bind one website account.

## Operator setup and deployment

1. Install root and stdio dependencies: `npm ci` and `npm run mcp:install`.
2. Run `npm test`, `npm run test:mcp`, `npm run typecheck`, `npm run build`, and
   `npm run remote:build`. The last command is a **dry run**.
3. Review `wrangler.remote.jsonc`. Set `REMOTE_ORIGIN` to the exact independent
   Worker HTTPS origin. Confirm `WEBSITE_ORIGIN` is the trusted website origin.
   Optionally add comma-separated exact `ALLOWED_ORIGINS`; never use a wildcard.
   Keep this Worker separate from the existing website configuration and routes.
4. Generate a cryptographically random personal token, at least 32 bytes, using
   Node's `crypto.randomBytes(32).toString('base64url')`. Compute its SHA-256 hex
   digest with `crypto.createHash('sha256').update(token).digest('hex')`.
   Give the raw token only to its intended user. Store only the following JSON
   registry in the Worker secret `REMOTE_ACCESS_TOKENS`:

   ```json
   { "SHA256_HEX_DIGEST": { "id": "unique-user-id", "scopes": ["profile", "agent", "byok"] } }
   ```

   Use `npx wrangler secret put REMOTE_ACCESS_TOKENS --config wrangler.remote.jsonc`.
   Do not commit raw tokens or the registry. Every user must have a unique stable
   ID; duplicate IDs fail closed. Grant only needed scopes. Remove a digest to
   revoke a token; rotate the token while preserving its user's ID to retain
   that user's state. Previously authorized in-flight calls can finish.
5. After explicit deployment approval, deploy with
   `npx wrangler deploy --config wrangler.remote.jsonc`.
   The configured migration creates this independent Worker's SQLite Durable
   Objects, not Supabase tables. No existing website production config changes
   are required. Ensure your Cloudflare account supports these bindings.
6. Test initialize, tool discovery, anonymous reads, two separate user profiles,
   rejected authentication, and browser approval before sharing the endpoint.

Local preview: `npm run remote:dev` (origin `http://localhost:8787`). Use local
Wrangler variables/secrets for the token registry. A remote Agent cannot connect
to localhost on another computer. On PowerShell use `npm.cmd` / `npx.cmd` if
script execution policy blocks `npm.ps1`.

## Protection and limitations

- Per-IP rate limiting: 40 requests/minute, including discovery. Cloudflare's
  rate limiter is approximate and distributed; it is not a global billing cap.
- Authenticated tool attempts: 200/day and 20 website generation attempts/day
  per principal (UTC); at most two concurrent calls. Failed attempts consume
  quota. Leases expire after ten minutes; active leases survive a UTC day reset.
- Request bodies are limited to 128 KiB. No JSON-RPC batches, session IDs,
  GET/SSE subscriptions, resumable sessions, or server-initiated sampling.
- Durable storage uses server-derived principal IDs, never user-supplied IDs,
  MCP sessions, IPs, or shared local files. Website connection grants are private
  server-side state; browser approval grants expire under the existing flow.
- Incoming cookies and Remote Authorization never become website credentials.
  Server global AI keys are never forwarded. Responses are not cacheable; the
  Worker does not log credentials. Review infrastructure logs separately.
- The pinned SDK is shared with stdio. This MVP uses its supported protocol
  negotiation; compatibility with future protocol-only hosts is not promised.
- Automated tests use actual SDK transports and clients with mocked upstream
  HTTP and transactional in-memory Durable storage. They do not replace deployed
  Cloudflare binding tests or a real GitHub authorization round trip.
- Remaining work: standard MCP OAuth, self-service token issuance/revocation,
  ownership-safe website PR review, operational monitoring, and load testing.
  Review existing dependency audit findings before production rollout.
