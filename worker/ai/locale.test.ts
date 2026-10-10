import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAIClient } from './client'
import { localeContext, getRequestLocale } from '../../server/src/middlewares/localeContext'
import { createClient } from '../../server/src/services/ai/client'
import type { Request, Response } from 'express'

afterEach(() => { vi.unstubAllGlobals() })

describe('AI language transport', () => {
  it('applies locale to both normal and streaming Worker completions', async () => {
    const bodies: Array<{ messages: Array<{ role: string; content: string }>; stream?: boolean }> = []
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body)
      bodies.push(body)
      return body.stream
        ? new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n')
        : Response.json({ choices: [{ message: { content: 'Hello' } }] })
    }))
    const client = createAIClient({ provider: 'deepseek', model: 'test', apiKey: 'test-only', locale: 'en-US' })
    const params = { messages: [{ role: 'system' as const, content: 'Return JSON.' },
      { role: 'user' as const, content: 'Original Issue: 修复 #12; repo/name' }] }
    expect(await client.chatCompletions(params)).toBe('Hello')
    let stream = ''
    for await (const token of client.streamChatCompletions(params)) stream += token
    expect(stream).toBe('Hello')
    expect(bodies).toHaveLength(2)
    for (const body of bodies) {
      expect(body.messages[0].content).toContain('English (en-US)')
      expect(body.messages[1]).toEqual(params.messages[1])
    }
  })
  it('isolates concurrent Express requests and captures locale in provider clients', async () => {
    const run = (language: string) => new Promise<string>((resolve) => {
      localeContext({ header: () => language } as unknown as Request, {} as Response, () => {
        const client = createClient({ mode: 'custom', provider: 'deepseek', model: 'test',
          baseUrl: 'https://api.deepseek.com', apiKey: 'test-only' })
        client.defaults.adapter = async (request) => {
          const body = JSON.parse(request.data)
          expect(body.messages[0].content).toContain(getRequestLocale())
          return { status: 200, statusText: 'OK', config: request, headers: {}, data: body.messages[0].content }
        }
        void client.post('/chat/completions', { messages: [{ role: 'system', content: 'Return JSON.' }] })
          .then((result) => resolve(result.data))
      })
    })
    const [english, chinese] = await Promise.all([run('en-US'), run('zh-CN')])
    expect(english).toContain('English (en-US)')
    expect(chinese).toContain('Simplified Chinese (zh-CN)')
  })
})
