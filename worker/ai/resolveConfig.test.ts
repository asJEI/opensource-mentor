import { describe, expect, it, vi } from 'vitest'
import { BYOK_HEADERS } from '../../shared/byok'
import type { PlatformEnv } from '../config'
import { resolveAIClient } from './resolveConfig'

function createEnv(limitSuccess = true): {
  env: PlatformEnv
  limit: ReturnType<typeof vi.fn>
} {
  const limit = vi.fn().mockResolvedValue({ success: limitSuccess })
  const env: PlatformEnv = {
    ASSETS: {} as Fetcher,
    GITHUB_API_BASE_URL: 'https://api.github.com',
    DEFAULT_LLM_PROVIDER: 'deepseek',
    DEFAULT_LLM_MODEL: 'deepseek-v4-flash',
    DEFAULT_LLM_BASE_URL: 'https://api.deepseek.com',
    LLM_TIMEOUT_MS: '60000',
    PLATFORM_GITHUB_TOKEN: '',
    PLATFORM_LLM_API_KEY: 'platform-secret',
    PLATFORM_AI_RATE_LIMITER: { limit },
  }
  return { env, limit }
}

describe('resolveAIClient', () => {
  it('ignores request provider overrides in platform mode', async () => {
    const { env, limit } = createEnv()
    const request = new Request('https://mentor.example/api/ai/chat', {
      headers: {
        [BYOK_HEADERS.aiBaseUrl]: 'https://attacker.example',
        [BYOK_HEADERS.aiModel]: 'attacker-model',
      },
    })

    const resolved = await resolveAIClient(env, request, {})

    expect(resolved.isCustom).toBe(false)
    expect(resolved.client.baseUrl).toBe('https://api.deepseek.com')
    expect(resolved.client.model).toBe('deepseek-v4-flash')
    expect(limit).toHaveBeenCalledOnce()
  })

  it('uses the user base URL and bypasses platform quota for BYOK', async () => {
    const { env, limit } = createEnv()
    const request = new Request('https://mentor.example/api/ai/chat', {
      headers: {
        [BYOK_HEADERS.aiMode]: 'custom',
        [BYOK_HEADERS.aiProvider]: 'openai-compatible',
        [BYOK_HEADERS.aiBaseUrl]: 'https://user-provider.example/v1',
        [BYOK_HEADERS.aiModel]: 'user-model',
        [BYOK_HEADERS.aiKey]: 'user-secret',
      },
    })

    const resolved = await resolveAIClient(env, request, {})

    expect(resolved.isCustom).toBe(true)
    expect(resolved.client.baseUrl).toBe('https://user-provider.example/v1')
    expect(resolved.client.model).toBe('user-model')
    expect(limit).not.toHaveBeenCalled()
  })

  it('uses OrcaRouter defaults for BYOK when base URL is omitted', async () => {
    const { env, limit } = createEnv()
    const request = new Request('https://mentor.example/api/ai/chat', {
      headers: {
        [BYOK_HEADERS.aiMode]: 'custom',
        [BYOK_HEADERS.aiProvider]: 'orcarouter',
        [BYOK_HEADERS.aiModel]: 'deepseek/deepseek-chat',
        [BYOK_HEADERS.aiKey]: 'sk-orca-user-secret',
      },
    })

    const resolved = await resolveAIClient(env, request, {})

    expect(resolved.isCustom).toBe(true)
    expect(resolved.client.provider).toBe('orcarouter')
    expect(resolved.client.baseUrl).toBe('https://api.orcarouter.ai/v1')
    expect(resolved.client.model).toBe('deepseek/deepseek-chat')
    expect(limit).not.toHaveBeenCalled()
  })

  it('rejects platform requests after the quota is exhausted', async () => {
    const { env } = createEnv(false)
    const request = new Request('https://mentor.example/api/ai/chat')

    await expect(resolveAIClient(env, request, {})).rejects.toMatchObject({
      status: 429,
      errorCode: 'AI_RATE_LIMIT',
    })
  })
})
