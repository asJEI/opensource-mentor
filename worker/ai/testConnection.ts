import type { AIClient } from './client'

export async function testAIConnection(client: AIClient): Promise<{
  success: boolean
  message: string
  model: string
  latencyMs: number
}> {
  const startedAt = Date.now()
  await client.chatCompletions({
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    temperature: 0,
  })
  return {
    success: true,
    message: 'AI API 连接成功',
    model: client.model,
    latencyMs: Date.now() - startedAt,
  }
}
