import { ApiError } from '../http'
import type { AIClient } from './client'
import { parseJsonSafely } from './json'
import { repoAnalysisPrompt } from './prompts/analysis'
import { systemPrompt } from './prompts/explain'
import type { RepoAnalysis, RepositoryDto } from './types'
import { validateRepoAnalysisResult } from './validate'

export async function analyzeRepository(
  client: AIClient,
  repository: RepositoryDto,
  readme: string,
): Promise<RepoAnalysis> {
  const prompt = repoAnalysisPrompt({
    repoName: repository.fullName,
    repoDescription: repository.description,
    repoLanguage: repository.language,
    stars: repository.stars,
    forks: repository.forks,
    openIssues: repository.openIssues,
    topics: repository.topics,
    license: repository.license,
    createdAt: repository.createdAt,
    updatedAt: repository.updatedAt,
    readme,
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
    return validateRepoAnalysisResult(parseJsonSafely(content))
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] analyzeRepository failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
