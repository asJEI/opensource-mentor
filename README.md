# OpenSource Mentor

English | [简体中文](./README.zh-CN.md)

> An AI mentor that helps developers make real open source contributions: understand a repository, choose an issue, follow a contribution guide, review changes, and prepare a Pull Request.

OpenSource Mentor connects these steps in one workspace. Recommendations use your public GitHub activity and contribution preferences to help you find tasks that fit your skills, available time, and goals. It supports first-time contributors as well as developers exploring unfamiliar projects.

## Try it

- [Cloudflare version](https://hokkai.top/)

Cloudflare Workers serves the static assets and API, including account and workspace persistence. For self-hosting, the Docker path uses the same frontend with Nginx and an Express API; Express has not yet integrated account storage.

## Features

- **Repository analysis**: understand project purpose, technologies, structure, and contribution opportunities.
- **Issue discovery and explanation**: evaluate tasks using your experience and preferences, check availability signals, and understand requirements before starting.
- **Contribution guides and learning roadmaps**: turn an issue into actionable chapters, including environment setup, reproduction, implementation, verification, and PR preparation.
- **AI mentor**: ask questions with your selected repository, issue, and guide progress in context.
- **PR drafts**: generate titles, descriptions, linked issues, and testing suggestions from your changes.
- **Code review**: review real GitHub PRs or fork branch diffs with grounded AI feedback; deterministic rules provide a fallback when the LLM is unavailable.
- **GitHub sign-in and developer profiles**: sign in with minimal public-profile permissions, then generate a profile in the background.
- **Bring your own keys (BYOK)**: use your GitHub Token or an OpenAI-compatible AI provider. Keys stay in page memory and must be entered again after refresh; non-secret configuration is saved locally.
- **English and Simplified Chinese**: the first visit follows the browser's preferred language. Chinese variants use `zh-CN`; other languages use `en-US`. Switch languages from the top navigation or workspace header. Your choice is saved in this browser's existing user preferences and survives refresh and sign-out.

New AI responses follow the selected language. Code, commands, repository names, original issue quotations, JSON fields, and technical identifiers are preserved. Existing conversations and generated artifacts retain their original language. Language preferences are device-local; they are not synchronized between devices.

## Contribution workflow

1. Sign in with GitHub and optionally fill in your goals, technologies, time budget, and guidance preferences.
2. Find a recommended issue, search within a repository, or evaluate a specific issue URL.
3. Check assignment, comments, related PRs, and the repository's claim process before starting.
4. Read the repository analysis and work through the contribution guide. Ask AI mentor when you get stuck.
5. Push changes to your fork, review the diff, generate a PR draft, and submit it on GitHub after checking the project's contribution rules.

## Local development

Requires Node.js 22 and npm.

### Cloudflare Worker mode

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

Use the URL printed by Vite, usually `http://localhost:5173`. On Windows PowerShell, use `Copy-Item .dev.vars.example .dev.vars` instead of `cp` if needed. The UI works without platform keys; real AI and GitHub requests depend on configuration, authentication, and API quotas.

Configure local secrets in `.dev.vars`:

```dotenv
PLATFORM_GITHUB_TOKEN=
PLATFORM_LLM_API_KEY=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SESSION_SECRET=
```

Non-secret defaults live in [wrangler.jsonc](./wrangler.jsonc). User BYOK settings belong in the product's Settings page.

### Express mode

```bash
npm ci
npm --prefix server ci
cp server/.env.example server/.env
npm --prefix server run dev
```

Express listens on `http://localhost:3001` by default and is used by the Docker deployment path. The current Vite development server runs the Worker API rather than proxying to Express.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PLATFORM_GITHUB_TOKEN` | Increase the GitHub API quota |
| `PLATFORM_LLM_API_KEY` | Platform LLM key |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret |
| `SUPABASE_URL` | Supabase project URL, Worker server only |
| `SUPABASE_SECRET_KEY` | Supabase server key, never sent to browsers |
| `SESSION_SECRET` | Separate session-signing secret |
| `DEFAULT_LLM_PROVIDER` | Default provider |
| `DEFAULT_LLM_BASE_URL` | OpenAI-compatible API URL |
| `DEFAULT_LLM_MODEL` | Default model |
| `LLM_TIMEOUT_MS` | AI request timeout |

Keep secrets in `.dev.vars` for local Workers, Wrangler/Dashboard Secrets for production Workers, `server/.env` for Express, or the root `.env` for Docker Compose. Do not commit these files or expose platform keys through `VITE_*` variables.

## Architecture and persistence

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Zustand |
| Cloudflare backend | Workers and Static Assets |
| Docker backend | Express, Node.js, Nginx |
| External APIs | GitHub REST and OpenAI-compatible LLM APIs |
| Validation | Vitest and TypeScript |

```text
src/           React pages, components, API services, Zustand stores, i18n
worker/        Cloudflare routes and runtime adapters
server/        Express API and runtime adapters
shared/        Shared contracts, locale utilities, and code-review logic
supabase/      Existing account and workspace migrations
public/        Static assets
```

The Worker path saves signed-in users' repositories, guides, chats, PR drafts, and reviews to Supabase, isolated by account and contribution task. Browser caches and pending queues support restoration; version conflicts require an explicit choice. Guests keep local progress. See the [storage implementation notes](./docs/storage-implementation-2026-10-06.md) for the existing migration and acceptance steps.

Internationalization adds no runtime dependencies or database migrations. UI copy lives in `src/i18n/en-US.json`; shared fallback copy lives in `shared/generated.en-US.json`. The persisted `preferences.language` field is the locale source. API clients send `Accept-Language`; requests without it retain the original Chinese behavior. Both normal and streaming AI calls apply the same output-language policy.

## Development checks

```bash
npm test
npm run typecheck
npm run typecheck:server
npm run build
npm --prefix server run build
```

No lint command is currently configured in this repository. Internationalization audit and validation details are recorded in [the i18n implementation notes](./docs/i18n-implementation.md).

## Deployment references

Docker configuration and troubleshooting: [DEPLOY.md](./DEPLOY.md).

Cloudflare configuration, GitHub Actions, and production checks: [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md).

## Security and project scope

BYOK credentials are sent per request and are not persisted by the server. Platform mode uses server-defined provider endpoints and models. Platform AI applies its own quota; BYOK uses your provider's quota.

OpenSource Mentor helps you understand projects and participate in their communities. Review AI suggestions against the actual repository, run appropriate checks, and follow maintainer contribution guidelines before submitting changes.
