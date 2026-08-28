import {
  normalizeBaseUrl,
  normalizeProvider,
  normalizeTimeoutMs,
  PLATFORM_PUBLIC_DEFAULTS,
  type PlatformConfig,
  type PlatformConfigStatus,
  toPlatformConfigStatus,
} from '../shared/config'

/**
 * Worker env: wrangler-generated vars/assets + optional platform secrets.
 * Secrets come from `.dev.vars` / `wrangler secret put` — never from `vars`.
 */
export type PlatformEnv = CloudflareEnv & {
  PLATFORM_GITHUB_TOKEN?: string
  GITHUB_OAUTH_CLIENT_ID?: string
  GITHUB_OAUTH_CLIENT_SECRET?: string
  SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  PLATFORM_LLM_API_KEY?: string
  PLATFORM_AI_RATE_LIMITER: RateLimit
}

export function resolvePlatformConfig(env: PlatformEnv): PlatformConfig {
  return {
    githubApiBaseUrl: normalizeBaseUrl(
      env.GITHUB_API_BASE_URL,
      PLATFORM_PUBLIC_DEFAULTS.githubApiBaseUrl,
    ),
    defaultLlmProvider: normalizeProvider(env.DEFAULT_LLM_PROVIDER),
    defaultLlmModel:
      env.DEFAULT_LLM_MODEL?.trim() || PLATFORM_PUBLIC_DEFAULTS.defaultLlmModel,
    defaultLlmBaseUrl: normalizeBaseUrl(
      env.DEFAULT_LLM_BASE_URL,
      PLATFORM_PUBLIC_DEFAULTS.defaultLlmBaseUrl,
    ),
    llmTimeoutMs: normalizeTimeoutMs(
      env.LLM_TIMEOUT_MS,
      PLATFORM_PUBLIC_DEFAULTS.llmTimeoutMs,
    ),
    platformGithubToken: env.PLATFORM_GITHUB_TOKEN?.trim() || '',
    platformLlmApiKey: env.PLATFORM_LLM_API_KEY?.trim() || '',
  }
}

export function getPlatformConfigStatus(
  env: PlatformEnv,
): PlatformConfigStatus {
  return toPlatformConfigStatus(resolvePlatformConfig(env))
}
