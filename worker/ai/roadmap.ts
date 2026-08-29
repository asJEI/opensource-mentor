import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { systemPrompt } from './prompts/explain'
import {
  roadmapPhasePrompt,
  roadmapPhaseRepairPrompt,
  roadmapPhaseSystemPrompt,
  roadmapPrompt,
} from './prompts/roadmap'
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

  // 2/4/6 章结构更重；给足输出额度，避免 JSON 截断导致“内容不完整”
  const maxTokens =
    params.phaseNumber === 2 ||
    params.phaseNumber === 4 ||
    params.phaseNumber === 6
      ? 3200
      : params.phaseNumber >= 5
        ? 2600
        : 2800

  const phaseTimeoutMs =
    params.phaseNumber >= 5 ||
    params.phaseNumber === 2 ||
    params.phaseNumber === 4
      ? 110_000
      : 95_000

  const callModel = async (
    temperature: number,
    timeoutMs: number,
    userContent: string,
  ): Promise<string> =>
    client.chatCompletions({
      messages: [
        { role: 'system', content: roadmapPhaseSystemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      topP: 0.85,
      maxTokens,
      timeoutMs,
      responseFormat: { type: 'json_object' },
    })

  const parseAndValidate = (content: string): RoadmapPhase =>
    validateRoadmapPhaseResult(parseJsonSafely(content), params.phaseNumber)

  try {
    let firstRaw = ''
    try {
      firstRaw = await callModel(0.35, phaseTimeoutMs, prompt)
      return parseAndValidate(firstRaw)
    } catch (firstError) {
      const message =
        firstError instanceof Error ? firstError.message : String(firstError)
      // 超时/限流等直接抛出；仅内容不完整走修复
      if (!message.includes('内容不完整')) throw firstError

      const repairPrompt = roadmapPhaseRepairPrompt({
        phaseNumber: params.phaseNumber,
        previousOutput: firstRaw || '（上一版为空或无法解析）',
      })

      try {
        const repairedRaw = await callModel(
          0.2,
          Math.min(phaseTimeoutMs, 80_000),
          firstRaw
            ? repairPrompt
            : `${prompt}\n\n注意：上一次输出不完整。请务必填满 goal、actionIntro、actionSteps（至少 2 项对象）。`,
        )
        return parseAndValidate(repairedRaw)
      } catch (secondError) {
        const secondMessage =
          secondError instanceof Error
            ? secondError.message
            : String(secondError)
        if (!secondMessage.includes('内容不完整')) throw secondError

        const lastRaw = await callModel(
          0.15,
          Math.min(phaseTimeoutMs, 80_000),
          `${prompt}\n\n最后机会：必须输出含至少 2 个 actionSteps 对象的完整 JSON。`,
        )
        return parseAndValidate(lastRaw)
      }
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
