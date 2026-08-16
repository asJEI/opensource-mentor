import type { AxiosInstance } from 'axios'
import {
  IssueExplain,
  Repository,
  Issue,
  RepoAnalysis,
  IssueRecommendation,
  PrDraft,
  Roadmap,
  ChatMessage,
  ChatResponse,
  UserProfileContext,
} from '../../types'
import { analyzeRepository as analyzeRepositoryFn } from './analyzeRepository'
import {
  createPlatformClient,
  getRuntime,
  testConnection as testConnectionFn,
} from './client'
import { explainIssue as explainIssueFn } from './explainIssue'
import { generatePrDraft as generatePrDraftFn } from './generatePR'
import { generateRoadmap as generateRoadmapFn } from './generateRoadmap'
import { chat as chatFn } from './mentorChat'
import { recommendIssues as recommendIssuesFn } from './recommendIssues'
import { reviewPr as reviewPrFn } from './reviewPr'
import type { ReviewPrParams } from './types'

/**
 * AI / LLM 服务层
 *
 * 支持 OpenAI 兼容格式的 API（DeepSeek / OpenAI / 通义千问 等）
 * 切换提供商只需修改环境变量中的 baseUrl 和 model
 *
 * 设计参考: https://github.com/asJEI/PR-Review
 * - confidence 置信度评分
 * - 可解释性 reasons
 * - 结构化 JSON 输出
 */
class AIService {
  private client: AxiosInstance | null = null
  private available = false

  constructor() {
    const platform = createPlatformClient()
    this.client = platform.client
    this.available = platform.available
  }

  /**
   * 检查 LLM 是否可用
   */
  isAvailable(): boolean {
    return this.available
  }

  async testConnection(): Promise<{
    success: boolean
    message: string
    model: string
    latencyMs: number
  }> {
    return testConnectionFn(getRuntime(this.client))
  }

  async explainIssue(
    repository: Repository,
    issue: Issue,
  ): Promise<IssueExplain> {
    return explainIssueFn(repository, issue, getRuntime(this.client))
  }

  /**
   * AI 分析仓库
   * 综合技术栈、活跃度、新人友好度等维度
   */
  async analyzeRepository(
    repository: Repository,
    readme: string,
  ): Promise<RepoAnalysis> {
    return analyzeRepositoryFn(repository, readme, getRuntime(this.client))
  }

  /**
   * 为一组 Issue 计算推荐分数
   * 从新人角度评估适合度
   */
  async recommendIssues(
    repository: Repository,
    issues: Issue[],
    userProfile: UserProfileContext,
  ): Promise<IssueRecommendation> {
    return recommendIssuesFn(
      repository,
      issues,
      userProfile,
      getRuntime(this.client),
    )
  }

  /**
   * 根据 Issue 生成 PR 草稿
   */
  async generatePrDraft(
    repository: Repository,
    issue: Issue,
    options?: {
      prType?: string
      additionalContext?: string
    },
  ): Promise<PrDraft> {
    return generatePrDraftFn(
      repository,
      issue,
      options,
      getRuntime(this.client),
    )
  }

  /**
   * 生成个性化学习路线图
   */
  async generateRoadmap(params: {
    repository: Repository
    readme: string
    userProfile: UserProfileContext
    goodFirstIssues: Issue[]
  }): Promise<Roadmap> {
    return generateRoadmapFn(params, getRuntime(this.client))
  }

  /**
   * AI 导师对话
   * 带仓库上下文的智能对话
   */
  async chat(params: {
    repository: Repository
    messages: ChatMessage[]
    userMessage: string
  }): Promise<ChatResponse> {
    return chatFn(params, getRuntime(this.client))
  }

  /**
   * AI 审查 PR 代码
   * 基于 PR 的 diff 内容和文件列表进行智能审查
   */
  async reviewPr(params: ReviewPrParams): Promise<any> {
    return reviewPrFn(params, getRuntime(this.client))
  }
}

export const aiService = new AIService()
export default aiService
