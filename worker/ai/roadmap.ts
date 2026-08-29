import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { systemPrompt } from './prompts/explain'
import { roadmapPhasePrompt, roadmapPrompt } from './prompts/roadmap'
import type {
  IssueDto,
  RepositoryDto,
  Roadmap,
  RoadmapPhase,
  UserProfileContext,
} from './types'
import {
  validateRoadmapPhaseResult,
  validateRoadmapResult,
} from './validate'

export async function generateRoadmapPhase(
  client: AIClient,
  params: {
    repository: RepositoryDto
    readme: string
    userProfile: UserProfileContext
    repositoryContext?: Record<string, unknown>
    issueContext?: Record<string, unknown>
    phaseNumber: number
  },
): Promise<RoadmapPhase> {
  const prompt = roadmapPhasePrompt({
    repoName: params.repository.fullName,
    repoDescription: params.repository.description,
    repoLanguage: params.repository.language,
    repoTopics: params.repository.topics,
    stars: params.repository.stars,
    userProfile: params.userProfile,
    readme: params.readme,
    repositoryContext: params.repositoryContext,
    issueContext: params.issueContext,
    phaseNumber: params.phaseNumber,
  })

  const attempt = async (temperature: number) => {
    const content = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      topP: 0.9,
      timeoutMs: 55_000,
      responseFormat: { type: 'json_object' },
    })
    return validateRoadmapPhaseResult(
      parseJsonSafely(content),
      params.phaseNumber,
    )
  }

  try {
    try {
      return await attempt(0.6)
    } catch (firstError) {
      // 内容不完整时自动重试一次，降低偶发空壳概率
      const message =
        firstError instanceof Error ? firstError.message : String(firstError)
      if (!message.includes('内容不完整')) throw firstError
      return await attempt(0.4)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[AI] generateRoadmapPhase failed:', message)
    if (message.includes('内容不完整')) {
      throw new ApiError(`第 ${params.phaseNumber} 章生成内容不完整，请重试`, 502, {
        errorCode: 'AI_PROVIDER_ERROR',
      })
    }
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}

/** 全量生成（兼容旧调用） */
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
