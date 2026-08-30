/**
 * Shared config contracts for Cloudflare Worker and legacy Express BFF.
 * Platform secrets never belong in the client bundle or git.
 * User BYOK values are request-scoped only (localStorage → request → Worker).
 */

export type PlatformLlmProvider =
  | 'deepseek'
  | 'openai'
  | 'orcarouter'
  | 'openai-compatible'

/** Non-secret platform defaults (safe for wrangler vars / docs). */
export interface PlatformPublicConfig {
  githubApiBaseUrl: string
  defaultLlmProvider: PlatformLlmProvider
  defaultLlmModel: string
  defaultLlmBaseUrl: string
  llmTimeoutMs: number
}

/** Platform credentials — Cloudflare Secrets / server env only. */
export interface PlatformSecrets {
  platformGithubToken: string
  platformLlmApiKey: string
}

export interface PlatformConfig extends PlatformPublicConfig, PlatformSecrets {}

/**
 * User BYOK / optional GitHub token — never loaded from server .env or Worker Secrets.
 * Carried per-request from the browser via BYOK headers (Task 8).
 */
export interface UserRequestConfig {
  provider?: PlatformLlmProvider
  apiKey?: string
  model?: string
  baseUrl?: string
  githubToken?: string
}

export const PLATFORM_PUBLIC_DEFAULTS: PlatformPublicConfig = {
  githubApiBaseUrl: 'https://api.github.com',
  defaultLlmProvider: 'deepseek',
  defaultLlmModel: 'deepseek-v4-flash',
  defaultLlmBaseUrl: 'https://api.deepseek.com',
  llmTimeoutMs: 120_000,
}

export const PLATFORM_LLM_PROVIDER_DEFAULT_BASE_URL: Record<
  PlatformLlmProvider,
  string
> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  orcarouter: 'https://api.orcarouter.ai/v1',
  'openai-compatible': '',
}

export const PLATFORM_LLM_PROVIDER_DEFAULT_MODEL: Record<
  PlatformLlmProvider,
  string
> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4o-mini',
  orcarouter: 'deepseek/deepseek-chat',
  'openai-compatible': '',
}

/** Safe status payload — never includes secret values. */
export interface PlatformConfigStatus {
  githubApiBaseUrl: string
  defaultLlmProvider: PlatformLlmProvider
  defaultLlmModel: string
  defaultLlmBaseUrl: string
  llmTimeoutMs: number
  platformGithubTokenConfigured: boolean
  platformLlmApiKeyConfigured: boolean
}

export function toPlatformConfigStatus(
  config: PlatformConfig,
): PlatformConfigStatus {
  return {
    githubApiBaseUrl: config.githubApiBaseUrl,
    defaultLlmProvider: config.defaultLlmProvider,
    defaultLlmModel: config.defaultLlmModel,
    defaultLlmBaseUrl: config.defaultLlmBaseUrl,
    llmTimeoutMs: config.llmTimeoutMs,
    platformGithubTokenConfigured: Boolean(config.platformGithubToken),
    platformLlmApiKeyConfigured: Boolean(config.platformLlmApiKey),
  }
}

export function normalizeProvider(value: string | undefined): PlatformLlmProvider {
  if (
    value === 'openai' ||
    value === 'orcarouter' ||
    value === 'openai-compatible' ||
    value === 'deepseek'
  ) {
    return value
  }
  return PLATFORM_PUBLIC_DEFAULTS.defaultLlmProvider
}

export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return trimmed.replace(/\/+$/, '')
}

export function normalizeTimeoutMs(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}
