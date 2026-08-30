/**
 * Legacy Express BFF platform config.
 * Reads PLATFORM_* (preferred) with legacy LLM_* / GITHUB_* aliases for Docker/VPS.
 * User BYOK must never be loaded from this module - only from request context
 * (see middlewares/aiRequestContext + githubRequestContext).
 *
 * Naming aligns with Worker platform config (shared/config.ts + worker/config.ts).
 */
import dotenv from 'dotenv'

dotenv.config()

type PlatformLlmProvider =
  | 'deepseek'
  | 'openai'
  | 'orcarouter'
  | 'openai-compatible'

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

function normalizeProvider(value: string | undefined): PlatformLlmProvider {
  if (
    value === 'openai' ||
    value === 'orcarouter' ||
    value === 'openai-compatible' ||
    value === 'deepseek'
  ) {
    return value
  }
  return 'deepseek'
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  return value.replace(/\/+$/, '')
}

function normalizeTimeoutMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function defaultBaseUrlForProvider(provider: PlatformLlmProvider): string {
  if (provider === 'openai') return 'https://api.openai.com/v1'
  if (provider === 'orcarouter') return 'https://api.orcarouter.ai/v1'
  if (provider === 'openai-compatible') return ''
  return 'https://api.deepseek.com'
}

function defaultModelForProvider(provider: PlatformLlmProvider): string {
  if (provider === 'openai') return 'gpt-4o-mini'
  if (provider === 'orcarouter') return 'deepseek/deepseek-chat'
  if (provider === 'openai-compatible') return ''
  return 'deepseek-v4-flash'
}

const githubApiBaseUrl = normalizeBaseUrl(
  readEnv('GITHUB_API_BASE_URL'),
  'https://api.github.com',
)
const defaultLlmProvider = normalizeProvider(
  readEnv('DEFAULT_LLM_PROVIDER') ?? readEnv('LLM_PROVIDER'),
)
const defaultLlmModel =
  readEnv('DEFAULT_LLM_MODEL') ??
  readEnv('LLM_MODEL') ??
  defaultModelForProvider(defaultLlmProvider)
const defaultLlmBaseUrl = normalizeBaseUrl(
  readEnv('DEFAULT_LLM_BASE_URL') ?? readEnv('LLM_API_BASE_URL'),
  defaultBaseUrlForProvider(defaultLlmProvider),
)
const llmTimeoutMs = normalizeTimeoutMs(
  readEnv('LLM_TIMEOUT_MS') ?? readEnv('LLM_TIMEOUT'),
  60_000,
)
// Preferred PLATFORM_*; legacy aliases for existing Docker .env files only.
const platformGithubToken =
  readEnv('PLATFORM_GITHUB_TOKEN') ?? readEnv('GITHUB_TOKEN') ?? ''
const platformLlmApiKey =
  readEnv('PLATFORM_LLM_API_KEY') ?? readEnv('LLM_API_KEY') ?? ''

/**
 * Compatibility shape used by existing Express services.
 * `.github.token` / `.llm.apiKey` are PLATFORM credentials only — not user BYOK.
 */
export const config = {
  /** Express listen port — unused on Cloudflare Workers. */
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  github: {
    baseUrl: githubApiBaseUrl,
    token: platformGithubToken,
  },
  llm: {
    provider: defaultLlmProvider,
    baseUrl: defaultLlmBaseUrl,
    apiKey: platformLlmApiKey,
    model: defaultLlmModel,
    timeout: llmTimeoutMs,
  },
  platform: {
    githubApiBaseUrl,
    defaultLlmProvider,
    defaultLlmModel,
    defaultLlmBaseUrl,
    llmTimeoutMs,
    platformGithubToken,
    platformLlmApiKey,
  },
}

export type AppConfig = typeof config
