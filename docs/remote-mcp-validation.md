# Remote MCP MVP validation — 2026-10-10

Branch: `codex/remote-mcp-mvp`. No push, online deployment, production
configuration update, or production database write was performed.

| Check | Result |
| --- | --- |
| `npm test` | 98 tests / 19 files passed, including 6 Remote MCP tests |
| `npm run test:mcp` | 16 passed, including a real stdio process initialization |
| `npm run typecheck` | Passed existing frontend and Worker TypeScript projects; shared MCP / remote implementation remains JavaScript |
| `npm run build` | Passed; existing frontend chunk-size warning remains |
| `npm run remote:build` | Passed independent Worker dry-run bundling, approximately 303 KiB gzip |
| Local Wrangler runtime | `/mcp` tool discovery returned HTTP 200 and 17 tools |
| Local SQLite Durable Objects | Concurrent profile saves for two distinct test principals returned HTTP 200; reads retained separate TypeScript/Python profiles |
| `git diff --check` | Passed |
| Production configuration diff | Existing `wrangler.jsonc` and GitHub workflows unchanged |
| Lint | Repository has no lint script; no lint result claimed |
| Dependency audit | 9 existing findings: 7 high, 2 moderate. All affected package versions match the pre-change lockfile |

Remote automated coverage: real SDK initialization/discovery/call, anonymous
public reads, all protected anonymous calls rejected, invalid credentials and
insufficient scopes, BYOK-only forwarding and no global-key fallback, concurrent
principal isolation, session-ID rejection, atomic daily/concurrency limits,
active lease preservation across UTC midnight, Origin validation, body-size and
batch rejection, and fail-closed missing rate-limit configuration.

Mocked HTTP tests do not exercise live AI providers or live GitHub browser
approval. Local runtime smoke tests used only private local Durable storage,
without syncing profiles to Supabase. Real browser approval, production binding
availability, load behavior, and host-specific configuration compatibility need
operator validation after a separately approved deployment.

Existing dependency findings affect @cloudflare/vite-plugin, @vitest/mocker,
axios, miniflare, sharp, source-map-js, undici, vitest, and wrangler. Handle them
in a separate dependency update before production rollout.
