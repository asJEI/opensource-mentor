# Remote MCP browser authorization

[简体中文](remote-mcp-oauth.zh-CN.md)

Configure only the URL in an MCP OAuth-capable host; remove legacy Authorization headers:

```json
{
  "mcpServers": {
    "opensource-mentor-remote": {
      "url": "https://opensource-mentor-remote-mvp.316920080dd.workers.dev/mcp"
    }
  }
}
```

Reconnect or use the host's sign-in button. The browser authorization page shows
the self-reported client name, exact callback and requested permissions. Check
the callback, then open the website approval link. Sign in with GitHub in the
website's existing flow; if needed, return to and refresh the approval tab after
login. Verify the connection code and approve or deny. Keep the OAuth tab open:
it polls every five seconds and returns to the Agent automatically. No manual
token copying is required.

Read the user's profile first and ask only for missing answers. Saving and
`sync: true` website synchronization still require user consent. Explicit
`modelSource: agent` uses the host model without an AI key. Website generation
requires a new authorization with `byok` scope and the user's own X-AI-Key.
OAuth never supplies the platform AI key. Default requested scopes are profile
and agent.

## Deployment

Run `npm ci`, `npm run mcp:install`, `npm test`, `npm run test:mcp`,
`npm run typecheck`, and `npm run remote:build`, then deploy the independent
Worker using `npx wrangler deploy --config wrangler.remote.jsonc`.

The v2 migration adds REMOTE_OAUTH SQLite Durable storage while preserving
REMOTE_USERS and its v1 migration. No new GitHub OAuth app, provider secrets,
Supabase schema or website deployment is needed. REMOTE_ORIGIN must equal the
actual Worker origin. REMOTE_OAUTH_REQUIRE_LOGIN=true challenges initialization
to trigger host login; false retains anonymous discovery/public calls, with
protected tools still returning OAuth challenges. Existing stdio and legacy
personal-token clients remain supported.

The authorization bridge uses the existing website device approval and profile
APIs. Website profile grants remain server-side. The host receives only an MCP
resource-bound access token. Different website users have separate profiles;
multiple hosts for the same verified immutable website account share that
account's profile. No cached profile is uploaded merely by signing in.

## Security and operational boundaries

- Protected-resource/authorization-server discovery, dynamic client registration
  (DCR), exact registered redirects and S256 PKCE. Public PKCE clients only;
  Client ID Metadata Documents (CIMD) are not implemented.
- Browser requests use HttpOnly cookies, same-origin enforcement and CSRF
  proof. Pages prohibit framing, referrer leakage and unauthorized scripts.
  Review infrastructure URL logs so callback authorization codes are not retained.
- Browser requests expire after ten minutes, single-use codes after two minutes,
  access tokens after at most one hour, authorization families after at most
  seven days or website-grant expiration. Refresh tokens rotate; reuse revokes
  the family. Each family issues at most 200 token pairs; client registrations
  expire after thirty days.
- `/oauth/revoke` accepts client_id and its token and revokes the family.
  `disconnect_account` removes website profile access, not every MCP login.
- Existing IP, daily and concurrent tool limits remain. Global authorization
  admission caps: 1000 client registrations/day and 1000 authorization starts/day.
  Alarms clean expired records; website upstream calls time out after ten seconds.
- Authorization operations use one serialized Durable Object for initial scale.
  Load-test and shard before high-concurrency rollout.
- Actual SDK OAuth discovery, registration, PKCE exchange, protected-tool calls,
  denial, replay, expiration and user isolation have automated coverage. GitHub
  approval is mocked in these tests; real Cursor/browser regression is still
  required. Existing dependency audit findings remain a separate production task.

Reference: [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
