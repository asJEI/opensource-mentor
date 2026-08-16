/**
 * LLM provider differences (base URL defaults, endpoint paths).
 * Feature modules must not branch on provider === ...
 */

import type { PlatformLlmProvider } from '../../shared/config'
import { ErrorCode } from '../../shared/errors'
import { ApiError } from '../http'

export type AIProvider = PlatformLlmProvider

export type AIConfig = {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl?: string
  timeoutMs?: number
}

export const PROVIDER_DEFAULT_BASE_URL: Record<AIProvider, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  'openai-compatible': '',
}

export const PROVIDER_DEFAULT_MODEL: Record<AIProvider, string> = {
  deepseek: 'deepseek-v4-flash',
  openai: 'gpt-4o-mini',
  'openai-compatible': '',
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const hostname = url.hostname.toLowerCase()
    return !(
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname === '::1' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^(fc|fd|fe8|fe9|fea|feb)/.test(hostname)
    )
  } catch {
    return false
  }
}

/** Resolve HTTPS base URL for the provider (no trailing slash). */
export function resolveProviderBaseUrl(config: AIConfig): string {
  if (config.provider === 'openai-compatible') {
    const baseUrl = config.baseUrl?.trim().replace(/\/+$/, '')
    if (!baseUrl || !isPublicHttpsUrl(baseUrl)) {
      throw new ApiError('OpenAI Compatible 需要有效的 HTTPS Base URL', 400, {
        errorCode: ErrorCode.AI_INVALID_BASE_URL,
      })
    }
    return baseUrl
  }

  const fallback = PROVIDER_DEFAULT_BASE_URL[config.provider]
  const baseUrl = (config.baseUrl?.trim() || fallback).replace(/\/+$/, '')
  if (!isPublicHttpsUrl(baseUrl)) {
    throw new ApiError('LLM Base URL 无效', 400, {
      errorCode: ErrorCode.AI_INVALID_BASE_URL,
    })
  }
  return baseUrl
}

/** OpenAI-compatible chat completions URL for all supported providers. */
export function resolveChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}
