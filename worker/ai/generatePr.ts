import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { systemPrompt } from './prompts/explain'
import { prDraftPrompt } from './prompts/pr'
import type { IssueDto, PrDraft, RepositoryDto } from './types'
import { validatePrDraftResult } from './validate'

export async function generatePrDraft(
  client: AIClient,
  repository: RepositoryDto,
  issue: IssueDto,
  options?: {
    prType?: string
    additionalContext?: string
  },
): Promise<PrDraft> {
  const prompt = prDraftPrompt({
    repoName: repository.fullName,
    repoLanguage: repository.language,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueBody: issue.body,
    issueLabels: issue.labels.map((l) => l.name),
    prType: options?.prType,
    additionalContext: options?.additionalContext,
  })

  try {
    const content = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      topP: 0.9,
      responseFormat: { type: 'json_object' },
    })
    return validatePrDraftResult(parseJsonSafely(content), issue)
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] generatePrDraft failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
