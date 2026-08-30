import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { systemPrompt } from './prompts/explain'
import { issueRecommendationPrompt } from './prompts/recommend'
import type {
  IssueDto,
  IssueRecommendation,
  RepositoryDto,
  UserProfileContext,
} from './types'
import { validateRecommendationResult } from './validate'

export async function recommendIssues(
  client: AIClient,
  repository: RepositoryDto,
  issues: IssueDto[],
  userProfile: UserProfileContext,
): Promise<IssueRecommendation> {
  const prompt = issueRecommendationPrompt({
    repoName: repository.fullName,
    repoLanguage: repository.language,
    repoDescription: repository.description,
    repoTopics: repository.topics,
    userProfile,
    issues: issues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels.map((l) => l.name),
      comments: issue.comments,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      author: issue.author,
    })),
  })

  try {
    const content = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      topP: 0.9,
      responseFormat: { type: 'json_object' },
    })
    return validateRecommendationResult(
      parseJsonSafely(content),
      issues,
      userProfile,
    )
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] recommendIssues failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
