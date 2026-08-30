import axios, { AxiosInstance } from 'axios'
import { config } from '../../config'
import { getRequestAIConfig } from '../../middlewares'
import type { AIProviderConfig } from '../../types'
import { AppError } from '../../utils/errors'
import type { AIRuntime } from './types'

export function createPlatformClient(): {
  client: AxiosInstance | null
  available: boolean
} {
  if (config.llm.baseUrl && config.llm.apiKey) {
    return {
      client: axios.create({
        baseURL: config.llm.baseUrl,
        timeout: config.llm.timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
      }),
      available: true,
    }
  }
  return { client: null, available: false }
}

export function createClient(providerConfig: AIProviderConfig): AxiosInstance {
  return axios.create({
    baseURL: providerConfig.baseUrl!.replace(/\/+$/, ''),
    timeout: config.llm.timeout,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerConfig.apiKey}`,
    },
  })
}

export function getRuntime(platformClient: AxiosInstance | null): AIRuntime {
  const requestConfig = getRequestAIConfig()
  if (requestConfig?.mode === 'custom') {
    return {
      client: createClient(requestConfig),
      model: requestConfig.model,
      isCustom: true,
    }
  }
  return {
    client: platformClient,
    model: config.llm.model,
    isCustom: false,
  }
}

export async function testConnection(runtime: AIRuntime): Promise<{
  success: boolean
  message: string
  model: string
  latencyMs: number
}> {
  if (!runtime.client) {
    throw new AppError('平台 AI API 尚未配置', 503)
  }

  const startedAt = Date.now()
  await runtime.client.post('/chat/completions', {
    model: runtime.model,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    max_tokens: 5,
    temperature: 0,
  })
  return {
    success: true,
    message: 'AI API 连接成功',
    model: runtime.model,
    latencyMs: Date.now() - startedAt,
  }
}

export async function listModels(runtime: AIRuntime): Promise<{
  provider: string
  models: Array<{
    id: string
    name: string
    provider?: string
    contextLength?: number
  }>
}> {
  if (!runtime.client) {
    throw new AppError('平台 AI API 尚未配置', 503)
  }

  const { data } = await runtime.client.get('/models', {
    headers: { Accept: 'application/json' },
  })
  const models = (Array.isArray(data?.data) ? data.data : [])
    .map((item: any) => {
      const id = typeof item?.id === 'string' ? item.id.trim() : ''
      if (!id) return null
      return {
        id,
        name:
          typeof item?.name === 'string' && item.name.trim()
            ? item.name.trim()
            : id,
        provider:
          typeof item?.provider === 'string' && item.provider.trim()
            ? item.provider.trim()
            : undefined,
        contextLength:
          typeof item?.context_length === 'number'
            ? item.context_length
            : typeof item?.contextLength === 'number'
              ? item.contextLength
              : undefined,
      }
    })
    .filter(Boolean)
    .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))

  return {
    provider: runtime.isCustom ? 'custom' : 'platform',
    models,
  }
}
