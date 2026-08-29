import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { systemPrompt } from './prompts/explain'
import { roadmapPrompt } from './prompts/roadmap'
import type {
  IssueDto,
  RepositoryDto,
  Roadmap,
  UserProfileContext,
} from './types'
import { validateRoadmapResult } from './validate'

export async function generateRoadmap(
  client: AIClient,
  params: {
    repository: RepositoryDto
    readme: string
    userProfile: UserProfileContext
    goodFirstIssues: IssueDto[]
    repositoryContext?: Record<string, unknown>
    issueContext?: Record<string, unknown>
  },
): Promise<Roadmap> {
  const {
    repository,
    readme,
    userProfile,
    goodFirstIssues,
    repositoryContext,
    issueContext,
  } = params
  const prompt = roadmapPrompt({
    repoName: repository.fullName,
    repoDescription: repository.description,
    repoLanguage: repository.language,
    repoTopics: repository.topics,
    stars: repository.stars,
    userProfile,
    readme,
    goodFirstIssues: goodFirstIssues.map((i) => ({
      number: i.number,
      title: i.title,
      labels: i.labels.map((l) => l.name),
    })),
    repositoryContext,
    issueContext,
  })

  try {
    const content = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      topP: 0.9,
      // 7 章指南 + 仓库上下文较长，给足上游生成时间
      timeoutMs: 120_000,
      responseFormat: { type: 'json_object' },
    })
    return validateRoadmapResult(parseJsonSafely(content))
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] generateRoadmap failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
