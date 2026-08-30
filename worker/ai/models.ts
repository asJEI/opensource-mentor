import { redactSecrets } from '../../shared/byok'
import { ErrorCode } from '../../shared/errors'
import { ApiError } from '../http'
import type { AIProvider } from './providers'

export type AIModelOption = {
  id: string
  name: string
  provider?: string
  contextLength?: number
}

function normalizeModelItem(item: unknown): AIModelOption | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const record = item as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  if (!id) return null
  return {
    id,
    name:
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : id,
    provider:
      typeof record.provider === 'string' && record.provider.trim()
        ? record.provider.trim()
        : undefined,
    contextLength:
      typeof record.context_length === 'number'
        ? record.context_length
        : typeof record.contextLength === 'number'
          ? record.contextLength
          : undefined,
  }
}

export async function listAIModels(
  params: {
    provider: AIProvider
    baseUrl: string
    apiKey: string
  },
  timeoutMs = 30_000,
): Promise<{
  provider: AIProvider
  models: AIModelOption[]
}> {
  const response = await fetch(`${params.baseUrl.replace(/\/+$/, '')}/models`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    let message = `模型列表读取失败 (${response.status})`
    try {
      const data = (await response.json()) as {
        error?: { message?: string }
        message?: string
      }
      message = redactSecrets(String(data.error?.message || data.message || message))
    } catch {
      // ignore non-JSON error body
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('AI API Key 无效或无权读取模型列表', 401, {
        errorCode: ErrorCode.AI_AUTH_ERROR,
      })
    }
    throw new ApiError(message, response.status, {
      errorCode: ErrorCode.AI_PROVIDER_ERROR,
    })
  }

  const payload = (await response.json()) as { data?: unknown[] }
  const models = (Array.isArray(payload.data) ? payload.data : [])
    .map(normalizeModelItem)
    .filter((item): item is AIModelOption => Boolean(item))
    .sort((a, b) => a.id.localeCompare(b.id))

  return {
    provider: params.provider,
    models,
  }
}
