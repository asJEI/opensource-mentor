import { ApiError } from '../http'
import type { AIClient } from './client'
import { chatSystemPrompt } from './prompts/chat'
import type {
  ChatMessage,
  ChatResponse,
  GuideMentorContext,
  RepositoryDto,
} from './types'
import { extractIssueNumbers, suggestNextSteps } from './validate'

export async function chatWithMentor(
  client: AIClient,
  params: {
    repository: RepositoryDto
    messages: ChatMessage[]
    userMessage: string
    guideContext?: GuideMentorContext | null
  },
): Promise<ChatResponse> {
  const { repository, messages, userMessage, guideContext } = params
  const systemPrompt = chatSystemPrompt({
    repoName: repository.fullName,
    repoDescription: repository.description,
    repoLanguage: repository.language,
    repoStars: repository.stars,
    repoTopics: repository.topics,
    guideContext: guideContext || null,
  })

  try {
    const reply = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map((m) => ({
          role:
            m.role === 'system'
              ? ('system' as const)
              : m.role === 'assistant'
                ? ('assistant' as const)
                : ('user' as const),
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
      temperature: 0.45,
      topP: 0.9,
    })

    return {
      message: reply,
      relatedIssues: extractIssueNumbers(reply),
      suggestedNextSteps: suggestNextSteps(reply),
      confidence: Math.min(0.95, 0.5 + reply.length / 2000),
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] chat failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
