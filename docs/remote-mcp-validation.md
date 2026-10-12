# Remote MCP MVP validation — 2026-10-10

## OAuth update — 2026-10-12

Branch `codex/remote-mcp-oauth`: project tests 104/20 files and stdio tests 16
passed; typecheck, website build and remote dry-run passed. Local Cloudflare
runtime returned resource metadata 200, DCR registration 201, initialization
401 with OAuth discovery challenge, and invalid-code rejection 400. New tests
exercise the real SDK OAuth client through discovery, registration, S256 PKCE
exchange and a protected profile call, plus exact redirects, audience binding,
browser CSRF/cookie proof, code replay, refresh rotation/reuse, revocation,
expiration, two verified website principals, denial and expired-record cleanup.
Browser GitHub approval is mocked in automated tests and still requires an
interactive host regression. No website code, Supabase schema, or platform AI
configuration was changed for OAuth.

Live independent Worker checks: SDK OAuth discovery/DCR returned REDIRECT,
authorization page HTTP 200 with a valid website approval link and HttpOnly
browser cookie; anonymous initialization returned 401 with resource discovery.
Cloudflare fetch uses manual redirects and refuses redirected upstream responses;
this has a regression test. No browser approval was performed by the assistant.

The remainder records the earlier MVP validation, before OAuth deployment.

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
