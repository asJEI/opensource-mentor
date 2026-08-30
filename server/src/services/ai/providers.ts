import { systemPrompt } from '../../utils/prompts'
import type { AIRuntime } from './types'

/** Default base URLs for known OpenAI-compatible providers. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  orcarouter: 'https://api.orcarouter.ai/v1',
  'openai-compatible': '',
}

/**
 * Call LLM with system prompt + user prompt, forcing JSON object response.
 */
export async function callLLM(
  userPrompt: string,
  temperature: number,
  runtime: Pick<AIRuntime, 'client' | 'model'>,
): Promise<string> {
  const { data } = await runtime.client!.post('/chat/completions', {
    model: runtime.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    top_p: 0.9,
    response_format: { type: 'json_object' },
  })

  return data.choices?.[0]?.message?.content || '{}'
}

/**
 * OpenAI-compatible chat/completions without forced JSON format.
 */
export async function chatCompletions(
  runtime: Pick<AIRuntime, 'client' | 'model'>,
  messages: Array<{ role: string; content: string }>,
  options?: {
    temperature?: number
    top_p?: number
    max_tokens?: number
    response_format?: { type: string }
  },
): Promise<{ content: string; data: unknown }> {
  const { data } = await runtime.client!.post('/chat/completions', {
    model: runtime.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.top_p ?? 0.9,
    ...(options?.max_tokens !== undefined ? { max_tokens: options.max_tokens } : {}),
    ...(options?.response_format ? { response_format: options.response_format } : {}),
  })
  return {
    content: data.choices?.[0]?.message?.content || '',
    data,
  }
}
