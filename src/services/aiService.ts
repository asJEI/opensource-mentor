import { bffPost, createBffHeaders } from './request'
import { ApiClientError } from './errors'
import { BYOK_HEADERS } from '@shared/byok'
import { useSettingsStore } from '@/store/settings'
import type {
  Issue,
  Repository,
  IssueExplain,
  ChatMessage,
  GuideMentorContext,
  PrDraft,
  Roadmap,
  RoadmapPhase,
  RepoAnalysis,
  IssueRecommendation,
  ChatResponse,
  UserProfileContext,
  AIProviderConfig,
  AIModelsResult,
  ConnectionTestResult,
} from '@/types'

// ============================================================
// AI 服务（通过 BFF 调用）
// ============================================================

class AiService {
  private withProviderConfig<T extends Record<string, unknown>>(
    payload: T,
  ): T & {
    aiProviderConfig?: {
      mode: 'custom'
      provider: AIProviderConfig['provider']
      model: string
      baseUrl?: string
    }
  } {
    const { aiConfig } = useSettingsStore.getState()
    if (aiConfig.mode !== 'custom') return payload
    // apiKey is sent via X-AI-Key header (see request interceptor) — never in body/URL.
    return {
      ...payload,
      aiProviderConfig: {
        mode: 'custom',
        provider: aiConfig.provider,
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl,
      },
    }
  }

  async testConnection(
    configOverride?: AIProviderConfig,
  ): Promise<ConnectionTestResult> {
    const aiConfig = configOverride ?? useSettingsStore.getState().aiConfig
    const headers: Record<string, string> = {}
    if (aiConfig.mode === 'custom') {
      headers[BYOK_HEADERS.aiMode] = 'custom'
      headers[BYOK_HEADERS.aiProvider] = aiConfig.provider
      if (aiConfig.model) headers[BYOK_HEADERS.aiModel] = aiConfig.model
      if (aiConfig.baseUrl) headers[BYOK_HEADERS.aiBaseUrl] = aiConfig.baseUrl
      if (aiConfig.apiKey) headers[BYOK_HEADERS.aiKey] = aiConfig.apiKey
    }
    return bffPost<ConnectionTestResult>(
      '/ai/test-connection',
      {
        aiProviderConfig: {
          mode: aiConfig.mode,
          provider: aiConfig.provider,
          model: aiConfig.model,
          baseUrl: aiConfig.baseUrl,
        },
      },
      { headers },
    )
  }

  async listModels(
    configOverride?: AIProviderConfig,
  ): Promise<AIModelsResult> {
    const aiConfig = configOverride ?? useSettingsStore.getState().aiConfig
    const headers: Record<string, string> = {}
    if (aiConfig.mode === 'custom') {
      headers[BYOK_HEADERS.aiMode] = 'custom'
      headers[BYOK_HEADERS.aiProvider] = aiConfig.provider
      if (aiConfig.model) headers[BYOK_HEADERS.aiModel] = aiConfig.model
      if (aiConfig.baseUrl) headers[BYOK_HEADERS.aiBaseUrl] = aiConfig.baseUrl
      if (aiConfig.apiKey) headers[BYOK_HEADERS.aiKey] = aiConfig.apiKey
    }
    return bffPost<AIModelsResult>(
      '/ai/models',
      {
        aiProviderConfig: {
          mode: aiConfig.mode,
          provider: aiConfig.provider,
          model: aiConfig.model || 'model-list',
          baseUrl: aiConfig.baseUrl,
        },
      },
      { headers },
    )
  }

  /**
   * AI 解释 Issue
   * POST /api/ai/explain
   */
  async explainIssue(issue: Issue, repo: Repository): Promise<IssueExplain> {
    const data = await bffPost<any>('/ai/explain', this.withProviderConfig({
      repository: {
        fullName: repo.fullName,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
      },
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
      },
    }))
    return this.mapIssueExplain(data)
  }

  /**
   * AI 分析仓库
   * POST /api/ai/analyze-repo
   */
  async analyzeRepository(owner: string, repo: string): Promise<{
    repository: Repository
    analysis: RepoAnalysis
  }> {
    const data = await bffPost<any>(
      '/ai/analyze-repo',
      this.withProviderConfig({ owner, repo }),
    )
    return {
      repository: {
        id: String(data.repository.id),
        owner: data.repository.owner,
        name: data.repository.name,
        fullName: data.repository.fullName,
        description: data.repository.description || '',
        stars: data.repository.stars || 0,
        forks: data.repository.forks || 0,
        issuesCount: data.repository.openIssues || 0,
        language: data.repository.language || '',
        size: data.repository.size || 0,
        homepage: data.repository.homepage || '',
        topics: data.repository.topics || [],
        license: data.repository.license || '',
        createdAt: data.repository.createdAt || '',
        updatedAt: data.repository.updatedAt || '',
        defaultBranch: data.repository.defaultBranch || '',
        ownerAvatar: data.repository.ownerAvatar || '',
        watchers: data.repository.watchers || 0,
        htmlUrl: data.repository.htmlUrl || '',
      },
      analysis: this.mapRepoAnalysis(data.analysis),
    }
  }

  /**
   * AI 推荐 Issue
   * POST /api/ai/recommend-issues
   */
  async recommendIssues(
    owner: string,
    repo: string,
    userProfile: UserProfileContext,
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      perPage?: number
      page?: number
    },
  ): Promise<IssueRecommendation> {
    const data = await bffPost<any>('/ai/recommend-issues', this.withProviderConfig({
      owner,
      repo,
      userProfile,
      ...params,
    }))
    return this.mapIssueRecommendation(data)
  }

  /**
   * AI 生成 PR 草稿
   * POST /api/ai/generate-pr
   */
  async generatePrDraft(
    owner: string,
    repo: string,
    issueNumber: number,
    prType?: string,
    additionalContext?: string,
  ): Promise<PrDraft> {
    const data = await bffPost<any>('/ai/generate-pr', this.withProviderConfig({
      owner,
      repo,
      issueNumber,
      prType,
      additionalContext,
    }))
    return this.mapPrDraft(data)
  }

  /**
   * 准备贡献指南上下文（不调用 LLM）
   * POST /api/ai/generate-roadmap-context
   */
  async prepareRoadmapContext(
    owner: string,
    repo: string,
    userProfile: UserProfileContext,
    issueContext?: Record<string, unknown>,
  ): Promise<{
    title: string
    description: string
    totalEstimatedTime: string
    phaseTitles: string[]
    repository: Record<string, unknown>
    readme: string
    repositoryContext: Record<string, unknown>
    issueContext: Record<string, unknown> | null
  }> {
    return bffPost('/ai/generate-roadmap-context', this.withProviderConfig({
      owner,
      repo,
      userProfile,
      issueContext,
    }), { timeout: 60_000 })
  }

  /**
   * 生成贡献指南单章
   * POST /api/ai/generate-roadmap-phase
   */
  async generateRoadmapPhase(
    owner: string,
    repo: string,
    phase: number,
    userProfile: UserProfileContext,
    shared: {
      repository: Record<string, unknown>
      readme: string
      repositoryContext: Record<string, unknown>
      issueContext?: Record<string, unknown> | null
    },
  ): Promise<RoadmapPhase> {
    const data = await bffPost<any>('/ai/generate-roadmap-phase', this.withProviderConfig({
      owner,
      repo,
      phase,
      userProfile,
      repository: shared.repository,
      readme: shared.readme,
      repositoryContext: shared.repositoryContext,
      issueContext: shared.issueContext || undefined,
    }), { timeout: 140_000 })
    return this.mapRoadmapPhase(data.phase, phase - 1)
  }

  /**
   * 流式生成贡献指南单章（NDJSON）
   * POST /api/ai/generate-roadmap-phase-stream
   */
  async streamGenerateRoadmapPhase(
    owner: string,
    repo: string,
    phase: number,
    userProfile: UserProfileContext,
    shared: {
      repository: Record<string, unknown>
      readme: string
      repositoryContext: Record<string, unknown>
      issueContext?: Record<string, unknown> | null
    },
    callbacks?: {
      onDelta?: (delta: string, accumulated: string) => void
      signal?: AbortSignal
    },
  ): Promise<RoadmapPhase> {
    const response = await fetch('/api/ai/generate-roadmap-phase-stream', {
      method: 'POST',
      headers: createBffHeaders(),
      body: JSON.stringify(
        this.withProviderConfig({
          owner,
          repo,
          phase,
          userProfile,
          repository: shared.repository,
          readme: shared.readme,
          repositoryContext: shared.repositoryContext,
          issueContext: shared.issueContext || undefined,
        }),
      ),
      signal: callbacks?.signal,
    })

    if (!response.ok) {
      let message = `流式生成失败 (${response.status})`
      try {
        const body = (await response.json()) as {
          message?: string
          errorCode?: string
        }
        if (body.message) message = body.message
        throw new ApiClientError(message, {
          errorCode: body.errorCode,
          status: response.status,
        })
      } catch (error) {
        if (error instanceof ApiClientError) throw error
        throw new ApiClientError(message, { status: response.status })
      }
    }

    if (!response.body) {
      throw new ApiClientError('流式响应为空', { status: 502 })
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as {
          type: string
          delta?: string
          phase?: Record<string, unknown>
          message?: string
        }

        if (event.type === 'start') continue

        if (event.type === 'delta' && event.delta) {
          accumulated += event.delta
          callbacks?.onDelta?.(event.delta, accumulated)
          continue
        }

        if (event.type === 'done' && event.phase) {
          return this.mapRoadmapPhase(event.phase, phase - 1)
        }

        if (event.type === 'error') {
          throw new ApiClientError(event.message || '本章生成失败', {
            status: 502,
            errorCode: 'AI_PROVIDER_ERROR',
          })
        }
      }
    }

    throw new ApiClientError('流式响应意外结束', { status: 502 })
  }

  /**
   * AI 生成学习路线图（全量，兼容）
   * POST /api/ai/generate-roadmap
   */
  async generateRoadmap(
    owner: string,
    repo: string,
    userProfile: UserProfileContext,
    issueContext?: Record<string, unknown>,
  ): Promise<Roadmap> {
    const data = await bffPost<any>('/ai/generate-roadmap', this.withProviderConfig({
      owner,
      repo,
      userProfile,
      issueContext,
    }), { timeout: 130_000 })
    return this.mapRoadmap(data)
  }

  /**
   * AI 导师对话
   * POST /api/ai/chat
   */
  async chat(
    owner: string,
    repo: string,
    messages: ChatMessage[],
    message: string,
    guideContext?: GuideMentorContext,
  ): Promise<ChatResponse> {
    const data = await bffPost<any>('/ai/chat', this.withProviderConfig({
      owner,
      repo,
      message,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(guideContext ? { guideContext } : {}),
    }))
    return {
      message: data.message,
      relatedIssues: data.relatedIssues || [],
      suggestedNextSteps: data.suggestedNextSteps || [],
      confidence: data.confidence || 0.7,
    }
  }

  // ============================================================
  // DTO 映射（后端数据 -> 前端类型）
  // ============================================================

  private mapIssueExplain(data: any): IssueExplain {
    return {
      summary: data.summary || '',
      difficulty: data.difficulty || 'medium',
      confirmedContext: data.confirmedContext || [],
      knowledge: data.knowledge || [],
      steps: data.steps || [],
      possibleAreasToInspect: data.possibleAreasToInspect || [],
      estimatedTime: data.estimatedTime || '',
      tips: data.tips || [],
    }
  }

  private mapRepoAnalysis(data: any): RepoAnalysis {
    return {
      overview: data.overview || '',
      techStack: data.techStack || {},
      activity: data.activity || {},
      beginnerFriendliness: data.beginnerFriendliness || {},
      domains: data.domains || [],
      gettingStartedTips: data.gettingStartedTips || [],
      contributionAreas: data.contributionAreas || [],
      confidence: data.confidence || 0.7,
    }
  }

  private mapIssueRecommendation(data: any): IssueRecommendation {
    return {
      items: (data.items || []).map((item: any) => ({
        // Issue 基础字段
        id: String(item.id),
        number: item.number,
        title: item.title,
        body: item.body || '',
        state: item.state,
        author: item.author,
        authorAvatar: item.authorAvatar || '',
        labels: (item.labels || []).map((l: any) => ({
          id: String(l.id),
          name: l.name,
          color: l.color || '000000',
          description: l.description || '',
        })),
        comments: item.comments || 0,
        createdAt: item.createdAt || '',
        updatedAt: item.updatedAt || '',
        htmlUrl: item.htmlUrl || '',
        assignees: [],
        // 推荐字段
        matchScore: item.matchScore ?? item.recommendationScore ?? 0,
        recommendationScore: item.recommendationScore ?? item.matchScore ?? 0,
        confidence: item.confidence || 0.5,
        difficulty: item.difficulty || 'medium',
        matchReasons:
          item.matchReasons || item.recommendationReasons || [],
        recommendationReasons:
          item.recommendationReasons || item.matchReasons || [],
        matchDetails: item.matchDetails || {
          difficultyMatch: 50,
          skillMatch: 50,
          impactScore: 50,
          activityScore: 50,
          beginnerFriendlyScore: 50,
        },
      })),
      total: data.total || 0,
      summary: data.summary || '',
    }
  }

  private mapPrDraft(data: any): PrDraft {
    // 后端类型转换为前端类型
    const typeMap: Record<string, 'bug' | 'feature' | 'docs'> = {
      fix: 'bug',
      feat: 'feature',
      docs: 'docs',
    }
    const type = typeMap[data.type] || 'bug'

    return {
      title: data.title || '',
      description: data.description || '',
      type,
      relatedIssue: data.relatedIssue || '',
      changes: data.changes || [],
      testingTips: data.testingTips || [],
      notes: data.notes || [],
      confidence: data.confidence || 0.6,
      improvementSuggestions: data.improvementSuggestions || [],
    }
  }

  private mapRoadmapPhase(phase: any, idx: number): RoadmapPhase {
    const learningItems = phase?.learningItems || []
    const actionSteps = Array.isArray(phase?.actionSteps)
      ? phase.actionSteps.map((step: any, stepIndex: number) => ({
          id: step?.id || `step-${idx + 1}-${stepIndex + 1}`,
          title: step?.title || `Step ${stepIndex + 1}`,
          description: step?.description || '',
          commands: Array.isArray(step?.commands) ? step.commands : [],
          expectedResult: step?.expectedResult || '',
          checkboxLabel: step?.checkboxLabel || '我已经完成',
          completed: false,
        }))
      : []
    const fileRefs = Array.isArray(phase?.fileRefs)
      ? phase.fileRefs
          .filter((item: any) => item?.path)
          .map((item: any) => ({
            path: String(item.path),
            reason: String(item.reason || '建议阅读'),
            githubUrl: typeof item.githubUrl === 'string' ? item.githubUrl : undefined,
          }))
      : []
    const reproduce = phase?.reproduce
      ? {
          title: phase.reproduce.title || '',
          steps: Array.isArray(phase.reproduce.steps) ? phase.reproduce.steps : [],
          constructExample: phase.reproduce.constructExample || '',
          expectedBehavior: phase.reproduce.expectedBehavior || '',
          actualBehavior: phase.reproduce.actualBehavior || '',
          checkboxLabel: phase.reproduce.checkboxLabel || '我成功复现了问题',
          completed: false,
        }
      : null

    return {
      id: `phase-${idx}`,
      phase: phase?.phase || idx + 1,
      title: phase?.title || '',
      goal: phase?.goal || '',
      actionIntro: phase?.actionIntro || '',
      actionSteps,
      fileRefs,
      reproduce,
      learningItems,
      recommendedIssues: phase?.recommendedIssues || [],
      estimatedDuration: phase?.estimatedDuration || '',
      difficulty: phase?.difficulty || 'medium',
      completionCriteria: phase?.completionCriteria || [],
      resources: phase?.resources || [],
      status: idx === 0 ? 'current' : 'pending',
      tasks: learningItems.map((item: string, ti: number) => ({
        id: `task-${idx}-${ti}`,
        text: item,
        completed: false,
      })),
      generationStatus: 'ready',
      generationError: null,
    }
  }

  private mapRoadmap(data: any): Roadmap {
    return {
      title: data.title || '',
      description: data.description || '',
      totalEstimatedTime: data.totalEstimatedTime || '',
      phases: (data.phases || []).map((phase: any, idx: number) =>
        this.mapRoadmapPhase(phase, idx),
      ),
      tips: data.tips || [],
      confidence: data.confidence || 0.7,
    }
  }
}

export const aiService = new AiService()
export default aiService
