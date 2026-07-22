import axios, { AxiosInstance } from 'axios'
import { config } from '../config'
import {
  IssueExplain,
  Repository,
  Issue,
  RepoAnalysis,
  IssueRecommendation,
  RecommendedIssue,
  PrDraft,
  Roadmap,
  ChatMessage,
  ChatResponse,
  UserProfileContext,
  AIProviderConfig,
} from '../types'
import { getRequestAIConfig } from '../middlewares'
import {
  issueExplainPrompt,
  repoAnalysisPrompt,
  issueRecommendationPrompt,
  prDraftPrompt,
  roadmapPrompt,
  chatSystemPrompt,
  systemPrompt,
} from '../utils/prompts'
import { AppError } from '../utils/errors'

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
    if (config.llm.baseUrl && config.llm.apiKey) {
      this.client = axios.create({
        baseURL: config.llm.baseUrl,
        timeout: config.llm.timeout,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
      })
      this.available = true
    }
  }

  /**
   * 检查 LLM 是否可用
   */
  isAvailable(): boolean {
    return this.available
  }

  private getRuntime(): {
    client: AxiosInstance | null
    model: string
    isCustom: boolean
  } {
    const requestConfig = getRequestAIConfig()
    if (requestConfig?.mode === 'custom') {
      return {
        client: this.createClient(requestConfig),
        model: requestConfig.model,
        isCustom: true,
      }
    }
    return {
      client: this.client,
      model: config.llm.model,
      isCustom: false,
    }
  }

  private createClient(providerConfig: AIProviderConfig): AxiosInstance {
    return axios.create({
      baseURL: providerConfig.baseUrl!.replace(/\/+$/, ''),
      timeout: config.llm.timeout,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerConfig.apiKey}`,
      },
    })
  }

  async testConnection(): Promise<{
    success: boolean
    message: string
    model: string
    latencyMs: number
  }> {
    const runtime = this.getRuntime()
    if (!runtime.client) {
      throw new AppError('平台 AI API 尚未配置', 503)
    }

    const startedAt = Date.now()
    await runtime.client.post('/chat/completions', {
      model: runtime.model,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      max_tokens: 5,
      temperature: 0,
    })
    return {
      success: true,
      message: 'AI API 连接成功',
      model: runtime.model,
      latencyMs: Date.now() - startedAt,
    }
  }

  // ============================================================
  // 1. Issue 解释
  // ============================================================

  async explainIssue(repository: Repository, issue: Issue): Promise<IssueExplain> {
    const runtime = this.getRuntime()
    if (!runtime.client) {
      return this.mockExplain(repository, issue)
    }

    try {
      const prompt = issueExplainPrompt({
        repoName: repository.fullName,
        repoDescription: repository.description,
        repoLanguage: repository.language,
        issueTitle: issue.title,
        issueBody: issue.body,
        issueLabels: issue.labels.map((l) => l.name),
        issueNumber: issue.number,
      })

      const content = await this.callLLM(prompt, 0.7, runtime)
      const parsed = this.parseJsonSafely(content)
      return this.validateExplainResult(parsed)
    } catch (err) {
      console.error('[AI] explainIssue failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockExplain(repository, issue)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  // ============================================================
  // 2. 仓库 AI 分析
  // ============================================================

  /**
   * AI 分析仓库
   * 综合技术栈、活跃度、新人友好度等维度
   */
  async analyzeRepository(repository: Repository, readme: string): Promise<RepoAnalysis> {
    const runtime = this.getRuntime()
    if (!runtime.client) {
      return this.mockAnalyzeRepo(repository)
    }

    try {
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

      const content = await this.callLLM(prompt, 0.7, runtime)
      const parsed = this.parseJsonSafely(content)
      return this.validateRepoAnalysisResult(parsed)
    } catch (err) {
      console.error('[AI] analyzeRepository failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockAnalyzeRepo(repository)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  // ============================================================
  // 3. Issue 推荐打分
  // ============================================================

  /**
   * 为一组 Issue 计算推荐分数
   * 从新人角度评估适合度
   */
  async recommendIssues(
    repository: Repository,
    issues: Issue[],
    userProfile: UserProfileContext,
  ): Promise<IssueRecommendation> {
    const runtime = this.getRuntime()
    if (!runtime.client) {
      return this.mockRecommendIssues(repository, issues, userProfile)
    }

    try {
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

      const content = await this.callLLM(prompt, 0.7, runtime)
      const parsed = this.parseJsonSafely(content)
      return this.validateRecommendationResult(parsed, issues, userProfile)
    } catch (err) {
      console.error('[AI] recommendIssues failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockRecommendIssues(repository, issues, userProfile)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  // ============================================================
  // 4. PR 草稿生成
  // ============================================================

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
    const runtime = this.getRuntime()
    if (!runtime.client) {
      return this.mockGeneratePrDraft(repository, issue, options)
    }

    try {
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

      const content = await this.callLLM(prompt, 0.7, runtime)
      const parsed = this.parseJsonSafely(content)
      return this.validatePrDraftResult(parsed, issue)
    } catch (err) {
      console.error('[AI] generatePrDraft failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockGeneratePrDraft(repository, issue, options)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  // ============================================================
  // 5. 学习路线图生成
  // ============================================================

  /**
   * 生成个性化学习路线图
   */
  async generateRoadmap(params: {
    repository: Repository
    readme: string
    userProfile: UserProfileContext
    goodFirstIssues: Issue[]
  }): Promise<Roadmap> {
    const { repository, readme, userProfile, goodFirstIssues } = params
    const runtime = this.getRuntime()

    if (!runtime.client) {
      return this.mockGenerateRoadmap(repository, userProfile, goodFirstIssues)
    }

    try {
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
      })

      const content = await this.callLLM(prompt, 0.8, runtime)
      const parsed = this.parseJsonSafely(content)
      return this.validateRoadmapResult(parsed)
    } catch (err) {
      console.error('[AI] generateRoadmap failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockGenerateRoadmap(repository, userProfile, goodFirstIssues)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  // ============================================================
  // 6. AI 导师对话
  // ============================================================

  /**
   * AI 导师对话
   * 带仓库上下文的智能对话
   */
  async chat(params: {
    repository: Repository
    messages: ChatMessage[]
    userMessage: string
  }): Promise<ChatResponse> {
    const { repository, messages, userMessage } = params
    const runtime = this.getRuntime()

    if (!runtime.client) {
      return this.mockChat(repository, userMessage)
    }

    try {
      const systemPrompt = chatSystemPrompt({
        repoName: repository.fullName,
        repoDescription: repository.description,
        repoLanguage: repository.language,
        repoStars: repository.stars,
        repoTopics: repository.topics,
      })

      // 构建消息列表：system + 历史消息 + 当前消息
      const openAIMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.slice(-10).map((m) => ({
          role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ]

      const { data } = await runtime.client.post('/chat/completions', {
        model: runtime.model,
        messages: openAIMessages,
        temperature: 0.7,
        top_p: 0.9,
      })

      const reply = data.choices?.[0]?.message?.content || ''

      // 从回复中提取相关 Issue 编号
      const relatedIssues = this.extractIssueNumbers(reply)

      // 简单的置信度估算（基于回复长度和相关性）
      const confidence = Math.min(0.95, 0.5 + reply.length / 2000)

      return {
        message: reply,
        relatedIssues,
        suggestedNextSteps: this.suggestNextSteps(reply),
        confidence,
      }
    } catch (err) {
      console.error('[AI] chat failed:', (err as Error).message)
      if (!runtime.isCustom && config.nodeEnv === 'development') {
        return this.mockChat(repository, userMessage)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  /**
   * 从文本中提取 Issue 编号
   */
  private extractIssueNumbers(text: string): number[] {
    const matches = text.match(/#(\d+)/g)
    if (!matches) return []
    const numbers = matches
      .map((m) => parseInt(m.slice(1), 10))
      .filter((n, i, arr) => arr.indexOf(n) === i)
    return numbers.slice(0, 5)
  }

  /**
   * 根据回复内容推测下一步建议
   */
  private suggestNextSteps(reply: string): string[] {
    const suggestions: string[] = []
    if (reply.includes('Issue') || reply.includes('issue')) {
      suggestions.push('查看相关的 Issue 详情')
    }
    if (reply.includes('文档') || reply.includes('README')) {
      suggestions.push('阅读项目文档了解更多')
    }
    if (reply.includes('代码') || reply.includes('源码')) {
      suggestions.push('浏览相关代码文件')
    }
    if (reply.includes('贡献') || reply.includes('PR')) {
      suggestions.push('尝试提交第一个 Pull Request')
    }
    suggestions.push('继续提问深入了解')
    return suggestions.slice(0, 3)
  }

  // ============================================================
  // 内部工具方法
  // ============================================================

  /**
   * 调用 LLM（统一封装，便于复用）
   */
  private async callLLM(
    userPrompt: string,
    temperature: number,
    runtime: { client: AxiosInstance | null; model: string },
  ): Promise<string> {
    const { data } = await runtime.client!.post('/chat/completions', {
      model: runtime.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      top_p: 0.9,
      response_format: { type: 'json_object' },
    })

    return data.choices?.[0]?.message?.content || '{}'
  }

  /**
   * 安全解析 JSON
   */
  private parseJsonSafely(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          return JSON.parse(match[0])
        } catch {
          // ignore
        }
      }
      return {}
    }
  }

  // ============================================================
  // 校验 & 标准化方法
  // ============================================================

  private validateExplainResult(parsed: Record<string, unknown>): IssueExplain {
    const difficulty = String(parsed.difficulty || 'medium').toLowerCase()
    const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
      ? (difficulty as 'easy' | 'medium' | 'hard')
      : 'medium'

    return {
      summary: String(parsed.summary || '暂无总结'),
      difficulty: validDifficulty,
      knowledge: this.ensureStringArray(parsed.knowledge, [
        '了解项目基本架构',
        '熟悉 Git 基本操作',
      ]),
      steps: this.ensureStringArray(parsed.steps, [
        '阅读 Issue 描述，理解需求',
        '在本地复现问题',
        '查找相关代码',
        '实现修复',
        '提交 PR',
      ]),
      estimatedTime: String(parsed.estimatedTime || '2-4 小时'),
      tips: this.ensureStringArray(parsed.tips, [
        '先看 CONTRIBUTING.md 了解贡献规范',
        '写代码前先和维护者确认方案',
        '提交后耐心等待 Review',
      ]),
    }
  }

  private validateRepoAnalysisResult(parsed: Record<string, unknown>): RepoAnalysis {
    const techStack = (parsed.techStack as Record<string, unknown>) || {}
    const activity = (parsed.activity as Record<string, unknown>) || {}
    const beginnerFriendliness = (parsed.beginnerFriendliness as Record<string, unknown>) || {}
    const contributionAreas = (parsed.contributionAreas as unknown[]) || []

    return {
      overview: String(parsed.overview || '暂无项目概述'),
      techStack: {
        primaryLanguage: String(techStack.primaryLanguage || '未知'),
        coreTechnologies: this.ensureStringArray(techStack.coreTechnologies),
        buildTools: this.ensureStringArray(techStack.buildTools),
        testFrameworks: this.ensureStringArray(techStack.testFrameworks),
        architecture: String(techStack.architecture || '未知'),
      },
      activity: {
        level: this.ensureEnum(
          activity.level,
          ['very-active', 'active', 'moderate', 'low', 'inactive'],
          'moderate',
        ),
        commitFrequency: String(activity.commitFrequency || '未知'),
        maintainerResponsiveness: String(activity.maintainerResponsiveness || '未知'),
        lastMajorUpdate: String(activity.lastMajorUpdate || '未知'),
      },
      beginnerFriendliness: {
        level: this.ensureEnum(
          beginnerFriendliness.level,
          ['very-friendly', 'friendly', 'moderate', 'challenging', 'hard'],
          'moderate',
        ),
        score: Number(beginnerFriendliness.score) || 5,
        friendlyFactors: this.ensureStringArray(beginnerFriendliness.friendlyFactors),
        challengingFactors: this.ensureStringArray(beginnerFriendliness.challengingFactors),
      },
      domains: this.ensureStringArray(parsed.domains),
      gettingStartedTips: this.ensureStringArray(parsed.gettingStartedTips),
      contributionAreas: contributionAreas
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((area) => ({
          name: String(area.name || '未命名'),
          description: String(area.description || ''),
          difficulty: this.ensureEnum(
            area.difficulty,
            ['easy', 'medium', 'hard'],
            'medium',
          ),
          whyGoodForBeginners: String(area.whyGoodForBeginners || ''),
        })),
      confidence: Number(parsed.confidence) || 0.7,
    }
  }

  private validateRecommendationResult(
    parsed: Record<string, unknown>,
    issues: Issue[],
    userProfile: UserProfileContext,
  ): IssueRecommendation {
    const items = (parsed.items as unknown[]) || []

    const scoredIssues: RecommendedIssue[] = items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const index = Number(item.index)
        const originalIssue = issues[index] || issues[0]
        const matchDetails = (item.matchDetails as Record<string, unknown>) || {}
        const matchScore =
          Number(item.matchScore ?? item.recommendationScore) || 50
        const parsedReasons = this.ensureStringArray(
          item.matchReasons ?? item.recommendationReasons,
        )
        const matchReasons =
          userProfile.profileSetupStatus !== 'completed'
            ? ['这是一个适合开源新手的 Issue。']
            : parsedReasons.length > 0
              ? parsedReasons
              : ['该 Issue 与你当前填写的画像具有一定匹配度']

        return {
          ...originalIssue,
          difficulty: this.ensureEnum(
            item.difficulty,
            ['easy', 'medium', 'hard'],
            'medium',
          ),
          matchScore,
          matchReasons,
          recommendationScore: matchScore,
          confidence: Number(item.confidence) || 0.6,
          recommendationReasons: matchReasons,
          matchDetails: {
            difficultyMatch: Number(matchDetails.difficultyMatch) || 50,
            skillMatch: Number(matchDetails.skillMatch) || 50,
            impactScore: Number(matchDetails.impactScore) || 50,
            activityScore: Number(matchDetails.activityScore) || 50,
            beginnerFriendlyScore: Number(matchDetails.beginnerFriendlyScore) || 50,
          },
        }
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)

    return {
      items: scoredIssues,
      total: scoredIssues.length,
      summary:
        userProfile.profileSetupStatus === 'completed'
          ? String(parsed.summary || '已结合你的画像筛选 Issue')
          : '用户未提供个性化画像，已按纯新手标准筛选 Issue。',
    }
  }

  private validatePrDraftResult(
    parsed: Record<string, unknown>,
    issue: Issue,
  ): PrDraft {
    const validTypes: PrDraft['type'][] = [
      'feat',
      'fix',
      'docs',
      'refactor',
      'test',
      'chore',
      'style',
      'perf',
    ]

    return {
      title: String(parsed.title || `fix: ${issue.title}`),
      description: String(parsed.description || '暂无描述'),
      type: this.ensureEnum(parsed.type, validTypes, 'fix'),
      relatedIssue: String(parsed.relatedIssue || `#${issue.number}`),
      changes: this.ensureStringArray(parsed.changes),
      testingTips: this.ensureStringArray(parsed.testingTips),
      notes: this.ensureStringArray(parsed.notes),
      confidence: Number(parsed.confidence) || 0.6,
      improvementSuggestions: this.ensureStringArray(parsed.improvementSuggestions),
    }
  }

  private validateRoadmapResult(parsed: Record<string, unknown>): Roadmap {
    const phases = (parsed.phases as unknown[]) || []

    return {
      title: String(parsed.title || '开源贡献学习路线图'),
      description: String(parsed.description || '帮助你从零开始参与开源项目'),
      totalEstimatedTime: String(parsed.totalEstimatedTime || '2-4 周'),
      phases: phases
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
        .map((phase, idx) => ({
          phase: Number(phase.phase) || idx + 1,
          title: String(phase.title || `第 ${idx + 1} 阶段`),
          goal: String(phase.goal || ''),
          learningItems: this.ensureStringArray(phase.learningItems),
          recommendedIssues: this.ensureStringArray(phase.recommendedIssues),
          estimatedDuration: String(phase.estimatedDuration || '1 周'),
          difficulty: this.ensureEnum(
            phase.difficulty,
            ['easy', 'medium', 'hard'],
            'medium',
          ),
          completionCriteria: this.ensureStringArray(phase.completionCriteria),
          resources: this.ensureStringArray(phase.resources),
        })),
      tips: this.ensureStringArray(parsed.tips),
      confidence: Number(parsed.confidence) || 0.7,
    }
  }

  // ============================================================
  // 辅助工具
  // ============================================================

  private ensureStringArray(value: unknown, fallback: string[] = []): string[] {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string')
    }
    return fallback
  }

  private ensureEnum<T extends string>(
    value: unknown,
    validValues: T[],
    fallback: T,
  ): T {
    const str = String(value)
    return (validValues as string[]).includes(str) ? (str as T) : fallback
  }

  // ============================================================
  // Mock 数据（开发/降级用）
  // ============================================================

  private mockExplain(repository: Repository, issue: Issue): IssueExplain {
    const isGoodFirstIssue = issue.labels.some(
      (l) =>
        l.name.toLowerCase().includes('good first') ||
        l.name.toLowerCase().includes('beginner') ||
        l.name.toLowerCase().includes('easy'),
    )
    const isDocs = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
    const language = repository.language || '对应编程语言'

    if (isGoodFirstIssue) {
      return {
        summary: `这是 ${repository.fullName} 仓库的一个"新手友好"Issue，主要涉及${isDocs ? '文档改进' : '简单的功能修复或小优化'}。对于第一次参与开源的开发者来说，这是一个很好的练手机会。`,
        difficulty: 'easy',
        knowledge: [
          `基础的 ${language} 语法知识`,
          'Git 和 GitHub 的基本使用（fork、clone、branch、PR）',
          '如何阅读项目文档和贡献指南',
          '基本的代码调试能力',
        ],
        steps: [
          'Fork 这个仓库到你的 GitHub 账号',
          'Clone 你 fork 的仓库到本地',
          '阅读项目的 README.md 和 CONTRIBUTING.md',
          '搭建本地开发环境，确保项目能正常运行',
          '找到相关代码文件，理解现有逻辑',
          '根据 Issue 需求进行修改',
          '本地测试验证修改是否正确',
          '提交 Pull Request 并等待 Review',
        ],
        estimatedTime: '2-4 小时',
        tips: [
          '提交 PR 前先检查是否有拼写错误或格式问题',
          '如果不确定如何实现，可以在 Issue 下评论提问',
          '参考项目中类似的已有改动，遵循项目的代码风格',
          'PR 描述要写清楚：做了什么、为什么这么做、如何验证',
        ],
      }
    }

    if (isDocs) {
      return {
        summary: `这是 ${repository.fullName} 仓库的一个文档类 Issue，主要涉及文档的补充、修正或改进。文档类 Issue 通常代码改动少，是新人入门开源的好选择。`,
        difficulty: 'easy',
        knowledge: [
          'Markdown 语法基础',
          'Git 和 GitHub 基本操作',
          '阅读理解英文文档的能力',
          '对项目功能的基本了解',
        ],
        steps: [
          'Fork 并 Clone 仓库到本地',
          '找到对应的文档文件',
          '仔细阅读现有文档，理解需要修改的地方',
          '根据 Issue 描述修改文档',
          '在本地预览修改效果',
          '检查拼写和格式',
          '提交 PR，附上修改前后的对比说明',
        ],
        estimatedTime: '1-2 小时',
        tips: [
          '文档修改也要遵循项目的风格和格式',
          '如果是翻译类修改，注意术语的一致性',
          '修改完后可以用 Markdown 预览工具检查格式',
          'PR 标题可以加上 docs: 前缀',
        ],
      }
    }

    return {
      summary: `这是 ${repository.fullName} 仓库的一个${issue.labels.length > 0 ? issue.labels[0].name + '类' : ''}Issue。${issue.body ? issue.body.slice(0, 100) + '...' : '需要先仔细阅读 Issue 描述，理解具体需求和背景。'}`,
      difficulty: 'medium',
      knowledge: [
        `熟练掌握 ${language}`,
        '理解项目的整体架构和模块划分',
        'Git 高级操作（rebase、cherry-pick 等）',
        '单元测试和集成测试的编写',
        '代码 Review 流程和规范',
      ],
      steps: [
        '仔细阅读 Issue 描述，理解需求和背景',
        'Fork 并 Clone 仓库，搭建开发环境',
        '在本地复现问题或理解功能需求',
        '查找相关代码，定位需要修改的位置',
        '设计实现方案，如有疑问在 Issue 中与维护者讨论',
        '编写代码，遵循项目代码风格',
        '添加或更新测试用例',
        '本地运行所有测试确保通过',
        '提交 PR，详细描述改动内容和测试方法',
      ],
      estimatedTime: '4-8 小时',
      tips: [
        '动手写代码前，先理解清楚需求，避免走弯路',
        '如果 Issue 比较复杂，可以先和维护者沟通你的实现思路',
        '保持 PR 小而专注，一个 PR 解决一个问题',
        '提交前运行项目的 lint 和 test，确保 CI 能通过',
        '耐心对待 Review 意见，这是学习成长的好机会',
      ],
    }
  }

  private mockAnalyzeRepo(repository: Repository): RepoAnalysis {
    const language = repository.language || 'JavaScript'
    const isPopular = repository.stars > 10000
    const isActive =
      new Date().getTime() - new Date(repository.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 30

    return {
      overview: `${repository.fullName} 是一个${repository.description || '知名开源项目'}，主要使用 ${language} 开发。该项目${isPopular ? '非常受欢迎，社区活跃' : '有一定的用户基础'}，${isActive ? '近期更新频繁' : '更新节奏适中'}。`,
      techStack: {
        primaryLanguage: language,
        coreTechnologies: [language, 'Git', 'CI/CD'],
        buildTools: language === 'TypeScript' || language === 'JavaScript' ? ['npm', 'Vite'] : ['make', 'cmake'],
        testFrameworks: language === 'TypeScript' || language === 'JavaScript' ? ['Vitest', 'Jest'] : ['单元测试框架'],
        architecture: isPopular ? '成熟的模块化架构' : '中等规模项目结构',
      },
      activity: {
        level: isActive ? (isPopular ? 'very-active' : 'active') : 'moderate',
        commitFrequency: isActive ? '每天都有提交' : '每周有若干次提交',
        maintainerResponsiveness: isPopular ? '维护者团队响应较快' : '维护者响应速度中等',
        lastMajorUpdate: repository.updatedAt,
      },
      beginnerFriendliness: {
        level: isPopular ? 'friendly' : 'moderate',
        score: isPopular ? 7 : 5,
        friendlyFactors: [
          '有详细的 README 文档',
          '有 CONTRIBUTING.md 贡献指南',
          '社区文档较完善',
          '有 good first issue 标签',
        ],
        challengingFactors: [
          isPopular ? '代码库较大，上手需要时间' : '项目文档可能不够完善',
          '需要一定的领域知识',
          '代码审查标准较严格',
        ],
      },
      domains: repository.topics.length > 0 ? repository.topics : [language, '开源', '开发工具'],
      gettingStartedTips: [
        '先阅读 README.md 和 CONTRIBUTING.md 了解项目',
        '从标有 good first issue 的 Issue 开始入手',
        '搭建本地开发环境，确保能跑通测试',
        '先从小的文档改进或 Bug 修复开始',
        '加入社区交流渠道，有问题及时提问',
        '阅读项目架构文档，理解模块划分',
      ],
      contributionAreas: [
        {
          name: '文档改进',
          description: '改进 README、文档、注释等，提升项目可读性',
          difficulty: 'easy',
          whyGoodForBeginners: '不需要深入理解代码，适合新人第一次贡献',
        },
        {
          name: 'Bug 修复',
          description: '修复标记为 bug 的 Issue，提升项目稳定性',
          difficulty: 'medium',
          whyGoodForBeginners: '有明确的问题描述，适合练习调试能力',
        },
        {
          name: '测试用例补充',
          description: '为项目添加单元测试，提升测试覆盖率',
          difficulty: 'medium',
          whyGoodForBeginners: '可以通过写测试深入理解代码逻辑',
        },
        {
          name: '功能优化',
          description: '对现有功能进行性能或体验优化',
          difficulty: 'hard',
          whyGoodForBeginners: '需要较深的代码理解，适合进阶练习',
        },
      ],
      confidence: 0.75,
    }
  }

  private mockRecommendIssues(
    repository: Repository,
    issues: Issue[],
    userProfile: UserProfileContext,
  ): IssueRecommendation {
    const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
    const repositoryLanguageAliases: Record<string, UserProfileContext['programmingLanguages'][number]> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      go: 'go',
      rust: 'rust',
      c: 'cpp',
      'c++': 'cpp',
    }
    const repositoryLanguage = repository.language
      ? repositoryLanguageAliases[repository.language.toLowerCase()]
      : undefined
    const hasLanguageMatch =
      hasPersonalProfile &&
      repositoryLanguage !== undefined &&
      userProfile.programmingLanguages.includes(repositoryLanguage)
    const languageLabel = repository.language || '当前仓库语言'

    const scored = issues.map((issue, index) => {
      const issueText = [
        issue.title,
        issue.body || '',
        ...issue.labels.map((label) => label.name),
      ]
        .join(' ')
        .toLowerCase()
      const hasGoodFirstLabel = issue.labels.some((l) =>
        l.name.toLowerCase().includes('good first'),
      )
      const hasDocLabel = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
      const hasBugLabel = issue.labels.some((l) => l.name.toLowerCase().includes('bug'))
      const hasHelpLabel = issue.labels.some((l) =>
        l.name.toLowerCase().includes('help wanted'),
      )
      const hasComments = issue.comments > 0
      const isRecent =
        new Date().getTime() - new Date(issue.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 30
      const interestMatches: Array<{
        value: UserProfileContext['interests'][number]
        label: string
        keywords: string[]
      }> = [
        { value: 'frontend', label: '前端', keywords: ['frontend', 'react', 'vue', 'css', ' ui '] },
        { value: 'backend', label: '后端', keywords: ['backend', 'server', 'api', 'database'] },
        { value: 'documentation', label: '文档', keywords: ['documentation', 'docs', 'readme'] },
        { value: 'testing', label: '测试', keywords: ['test', 'testing', 'coverage'] },
        { value: 'devops', label: 'DevOps', keywords: ['devops', 'ci', 'docker', 'workflow'] },
        { value: 'ai', label: 'AI', keywords: [' ai ', 'llm', 'model', 'prompt'] },
      ]
      const matchedInterest = hasPersonalProfile
        ? interestMatches.find(
            (interest) =>
              userProfile.interests.includes(interest.value) &&
              interest.keywords.some((keyword) => issueText.includes(keyword)),
          )
        : undefined
      const difficulty: RecommendedIssue['difficulty'] =
        hasGoodFirstLabel || hasDocLabel
          ? 'easy'
          : /\b(architecture|refactor|performance|breaking)\b/.test(issueText)
            ? 'hard'
            : 'medium'
      const difficultyMatch = {
        beginner: { easy: 92, medium: 58, hard: 28 },
        some_experience: { easy: 78, medium: 88, hard: 55 },
        project_experience: { easy: 62, medium: 88, hard: 78 },
      }[userProfile.experienceLevel][difficulty]

      let score = 50
      if (hasGoodFirstLabel) score += 25
      if (hasDocLabel) score += 15
      if (hasHelpLabel) score += 10
      if (hasBugLabel) score += 5
      if (isRecent) score += 5
      if (hasComments) score += 5
      if (hasLanguageMatch) score += 8
      if (matchedInterest) score += 10
      score += Math.round((difficultyMatch - 60) / 5)
      if (
        hasPersonalProfile &&
        (userProfile.goals.includes('first_contribution') ||
          userProfile.goals.includes('find_beginner_friendly_issues')) &&
        difficulty === 'easy'
      ) {
        score += 6
      }
      if (
        hasPersonalProfile &&
        userProfile.goals.includes('improve_engineering') &&
        (hasBugLabel || issueText.includes('test'))
      ) {
        score += 5
      }
      if (
        hasPersonalProfile &&
        userProfile.goals.includes('learn_new_technology') &&
        repositoryLanguage !== undefined &&
        userProfile.programmingLanguages.length > 0 &&
        !userProfile.programmingLanguages.includes(repositoryLanguage)
      ) {
        score += 4
      }
      if (
        userProfile.experienceLevel === 'beginner' &&
        difficulty === 'hard'
      ) {
        score -= 20
      }
      score = Math.min(100, Math.max(0, score + (index % 5) * 2 - 4))

      const reasons: string[] = []
      if (!hasPersonalProfile) {
        reasons.push('这是一个适合开源新手的 Issue。')
      }
      if (hasLanguageMatch) {
        reasons.push(`该仓库主要使用 ${languageLabel}，与你填写的编程语言匹配`)
      }
      if (matchedInterest) {
        reasons.push(`属于你感兴趣的${matchedInterest.label}方向`)
      }
      if (
        hasPersonalProfile &&
        userProfile.goals.includes('first_contribution') &&
        difficulty === 'easy'
      ) {
        reasons.push('难度符合你完成第一次开源贡献的目标')
      }
      if (
        hasPersonalProfile &&
        userProfile.goals.includes('improve_engineering') &&
        (hasBugLabel || issueText.includes('test'))
      ) {
        reasons.push('包含调试或测试实践，有助于提升工程能力')
      }
      if (hasGoodFirstLabel) reasons.push('标有 good first issue 标签，官方推荐新人入手')
      if (hasDocLabel) reasons.push('文档类改动，门槛较低，适合新人')
      if (hasHelpLabel) reasons.push('维护者标记为需要帮助，欢迎贡献')
      if (isRecent) reasons.push('近期有更新，活跃度较高')
      if (hasComments) reasons.push('有讨论记录，可以参考其他人的思路')
      if (reasons.length === 0) reasons.push('难度适中，有学习价值')

      return {
        ...issue,
        difficulty,
        matchScore: score,
        matchReasons: reasons,
        recommendationScore: score,
        confidence: 0.65,
        recommendationReasons: reasons,
        matchDetails: {
          difficultyMatch,
          skillMatch: hasLanguageMatch
            ? 92
            : matchedInterest
              ? 82
            : hasPersonalProfile && userProfile.programmingLanguages.length > 0
              ? 48
              : 60,
          impactScore: hasBugLabel ? 75 : 60,
          activityScore: isRecent ? 80 : 55,
          beginnerFriendlyScore: hasGoodFirstLabel ? 90 : hasDocLabel ? 80 : 55,
        },
      }
    })

    scored.sort((a, b) => b.recommendationScore - a.recommendationScore)

    return {
      items: scored,
      total: scored.length,
      summary: hasPersonalProfile
        ? `已结合你的编程语言、开发经验、兴趣和学习目标，从 ${issues.length} 个 Issue 中完成匹配。`
        : `用户未提供个性化画像，已从 ${issues.length} 个 Issue 中按纯新手标准筛选任务。`,
    }
  }

  private mockGeneratePrDraft(
    repository: Repository,
    issue: Issue,
    options?: { prType?: string; additionalContext?: string },
  ): PrDraft {
    const isBug = issue.labels.some((l) => l.name.toLowerCase().includes('bug'))
    const isDocs = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
    const isFeature = issue.labels.some((l) =>
      l.name.toLowerCase().includes('feature') || l.name.toLowerCase().includes('enhancement'),
    )

    let type: PrDraft['type'] = 'fix'
    if (options?.prType) {
      type = options.prType as PrDraft['type']
    } else if (isDocs) {
      type = 'docs'
    } else if (isFeature) {
      type = 'feat'
    }

    const typePrefix = {
      feat: 'feat',
      fix: 'fix',
      docs: 'docs',
      refactor: 'refactor',
      test: 'test',
      chore: 'chore',
      style: 'style',
      perf: 'perf',
    }[type]

    return {
      title: `${typePrefix}: ${issue.title}`,
      description: `## 描述\n\n本 PR 解决了 #${issue.number} Issue。\n\n### 做了什么\n\n- 根据 Issue 描述实现了对应的改动\n- 遵循了项目的代码风格和贡献规范\n\n### 为什么这么做\n\n${issue.body ? issue.body.slice(0, 200) : '解决 Issue 中描述的问题'}\n\n### 如何验证\n\n1. 在本地拉取分支并运行项目\n2. 按照 Issue 中的步骤复现原问题\n3. 确认问题已修复且没有引入新问题\n4. 运行所有测试确保通过`,
      type,
      relatedIssue: `#${issue.number}`,
      changes: [
        `根据 Issue #${issue.number} 的需求进行了相应修改`,
        '遵循了项目的代码风格和命名规范',
        '更新了相关的文档和注释（如适用）',
        '添加了必要的测试用例（如适用）',
      ],
      testingTips: [
        '在本地运行项目，按照 Issue 中的步骤验证功能',
        '运行项目的单元测试，确保没有破坏现有功能',
        '检查代码风格是否符合项目规范',
        '在不同的环境/浏览器中测试（如适用）',
      ],
      notes: [
        '这是 AI 生成的草稿，请根据实际情况调整',
        '建议先在本地充分测试后再提交',
        '如果改动较大，建议拆分成多个小 PR',
        '提交前请阅读项目的 CONTRIBUTING.md',
      ],
      confidence: 0.6,
      improvementSuggestions: [
        '补充具体的代码变更说明',
        '添加更详细的测试步骤和预期结果',
        '附上修改前后的对比截图（UI 改动）',
        '根据实际修改的文件细化 changes 列表',
      ],
    }
  }

  private mockGenerateRoadmap(
    repository: Repository,
    userProfile: UserProfileContext,
    goodFirstIssues: Issue[],
  ): Roadmap {
    const language = repository.language || 'JavaScript'
    const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
    const experienceLevel = hasPersonalProfile
      ? userProfile.experienceLevel
      : 'beginner'
    const languageAliases: Record<string, UserProfileContext['programmingLanguages'][number]> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      go: 'go',
      rust: 'rust',
      c: 'cpp',
      'c++': 'cpp',
    }
    const repositoryLanguage = repository.language
      ? languageAliases[repository.language.toLowerCase()]
      : undefined
    const knowsRepositoryLanguage =
      hasPersonalProfile &&
      repositoryLanguage !== undefined &&
      userProfile.programmingLanguages.includes(repositoryLanguage)
    const needsLanguageFoundation =
      hasPersonalProfile &&
      userProfile.goals.includes('learn_new_technology') &&
      repositoryLanguage !== undefined &&
      !knowsRepositoryLanguage
    const interestFocus = hasPersonalProfile
      ? {
          frontend: '优先阅读界面、组件和交互相关模块',
          backend: '优先阅读 API、服务和数据处理模块',
          documentation: '优先实践文档结构、示例和开发者指南改进',
          testing: '优先理解测试框架并补充单元测试',
          devops: '优先理解 CI、构建和部署流程',
          ai: '优先阅读模型调用、Prompt 和 AI 功能模块',
          other: '根据 Issue 标签选择最感兴趣的贡献方向',
        }[userProfile.interests[0]]
      : undefined
    const issueRefs = goodFirstIssues.slice(0, 3).map(
      (i) => `#${i.number} ${i.title.slice(0, 40)}`,
    )
    if (issueRefs.length === 0) {
      issueRefs.push('#xxx 寻找 good first issue 标签的任务')
    }

    const phases = [
      {
        phase: 1,
        title: '项目认知与环境准备',
        goal: '了解项目背景和定位，搭建本地开发环境',
        learningItems: [
          `阅读 ${repository.fullName} 的 README.md 和项目介绍`,
          '了解项目的核心功能和架构设计',
          '学习 Git 和 GitHub 基本操作（fork、clone、branch）',
          `搭建本地开发环境，确保能跑通 ${language} 项目`,
          '阅读 CONTRIBUTING.md 了解贡献规范',
        ],
        recommendedIssues: issueRefs.slice(0, 1),
        estimatedDuration: '2-3 天',
        difficulty: 'easy' as const,
        completionCriteria: [
          '能独立 fork 和 clone 项目',
          '本地能成功运行项目',
          '能说出项目的 3 个核心功能',
          '了解提交 PR 的基本流程',
        ],
        resources: [
          '项目 README.md',
          'CONTRIBUTING.md',
          'Git 入门教程',
          `${language} 基础入门`,
        ],
      },
      {
        phase: 2,
        title: '代码阅读与模块理解',
        goal: '熟悉项目代码结构，理解核心模块的作用',
        learningItems: [
          '浏览项目目录结构，了解各模块功能',
          '从入口文件开始追踪主要执行流程',
          '学习项目的代码风格和命名规范',
          '理解核心数据结构和 API 设计',
          '阅读关键模块的代码和注释',
        ],
        recommendedIssues: issueRefs.slice(0, 2),
        estimatedDuration: '3-5 天',
        difficulty: 'easy' as const,
        completionCriteria: [
          '能画出项目的模块关系图',
          '能解释核心功能的实现原理',
          '能独立定位某个功能的代码位置',
          '理解项目的测试框架',
        ],
        resources: [
          '项目架构文档',
          'API 文档',
          '开发者指南',
          '核心模块源码',
        ],
      },
      {
        phase: 3,
        title: '小试牛刀：文档与简单修复',
        goal: '从文档和简单 Bug 开始，完成第一次贡献',
        learningItems: [
          '学习如何写高质量的文档',
          '练习使用项目的测试框架',
          '掌握代码审查的基本礼仪',
          '学习如何写清晰的 PR 描述',
          '了解维护者的 Review 习惯',
        ],
        recommendedIssues: issueRefs,
        estimatedDuration: '5-7 天',
        difficulty: 'easy' as const,
        completionCriteria: [
          '提交第一个文档类 PR 并被合并',
          '能独立运行单元测试',
          '正确响应 Review 意见',
          '了解项目的 CI/CD 流程',
        ],
        resources: [
          '文档规范指南',
          '测试用例编写指南',
          'PR 模板',
          '代码审查最佳实践',
        ],
      },
      {
        phase: 4,
        title: '深入参与：Bug 修复',
        goal: '独立完成 Bug 修复，加深对代码的理解',
        learningItems: [
          '学习调试技巧和问题定位方法',
          '理解 Bug 报告的标准格式',
          '练习编写回归测试',
          '掌握 Git 进阶操作（rebase、cherry-pick）',
          '学习如何与维护者有效沟通',
        ],
        recommendedIssues: ['#xxx 选择标注为 bug 的简单 Issue'],
        estimatedDuration: '1-2 周',
        difficulty: 'medium' as const,
        completionCriteria: [
          '独立完成一个 Bug 修复 PR',
          '能写对应的单元测试',
          '理解项目的错误处理模式',
          '能在 Issue 中清晰描述问题和方案',
        ],
        resources: [
          '调试技巧教程',
          '测试覆盖率报告',
          'Bug 报告模板',
          'Git 进阶指南',
        ],
      },
      {
        phase: 5,
        title: '功能贡献：小功能开发',
        goal: '参与小功能开发，学习完整的贡献流程',
        learningItems: [
          '学习功能需求的分析方法',
          '理解项目的设计理念和取舍',
          '练习编写功能设计文档',
          '掌握代码优化和性能调优',
          '学习如何做 Code Review',
        ],
        recommendedIssues: ['#xxx 选择 enhancement 类的小功能'],
        estimatedDuration: '1-2 周',
        difficulty: 'medium' as const,
        completionCriteria: [
          '独立完成一个小功能的开发',
          '代码通过所有测试和 Lint',
          'PR 被维护者接受合并',
          '能给其他贡献者提供 Review 意见',
        ],
        resources: [
          '功能设计规范',
          '性能优化指南',
          'Code Review 指南',
          '项目路线图',
        ],
      },
      {
        phase: 6,
        title: '社区融入与持续贡献',
        goal: '成为活跃的社区成员，帮助更多新人',
        learningItems: [
          '学习如何帮助新贡献者',
          '参与社区讨论和决策',
          '了解项目的治理结构',
          '练习技术写作和分享',
          '建立个人开源品牌',
        ],
        recommendedIssues: ['#xxx 参与讨论类 Issue'],
        estimatedDuration: '持续进行',
        difficulty: 'hard' as const,
        completionCriteria: [
          '能独立 Review 新人的 PR',
          '积极参与社区讨论',
          '有 3 个以上被合并的 PR',
          '被社区认可为活跃贡献者',
        ],
        resources: [
          '社区行为准则',
          '维护者指南',
          '开源治理文档',
          '技术写作指南',
        ],
      },
    ]

    // 根据统一用户画像调整起点
    let startIdx = 0
    if (experienceLevel === 'some_experience') startIdx = 1
    if (experienceLevel === 'project_experience') startIdx = 3

    const adjustedPhases = phases.slice(startIdx).map((p, i) => ({
      ...p,
      phase: i + 1,
      learningItems: [
        ...p.learningItems,
        ...(i === 0 && needsLanguageFoundation
          ? [`补齐 ${language} 基础，并完成一个仓库内的小练习`]
          : []),
        ...(i === 0 && knowsRepositoryLanguage
          ? [`直接使用已有的 ${language} 经验理解项目代码规范`]
          : []),
        ...(i === 0 && interestFocus ? [interestFocus] : []),
      ],
    }))

    const audienceDescription = {
      beginner: '开源新手',
      some_experience: '写过一些代码的开发者',
      project_experience: '有完整项目经验的开发者',
    }[experienceLevel]
    const goalTip = hasPersonalProfile
      ? {
          first_contribution: '以合并第一个 PR 作为近期路线里程碑',
          find_beginner_friendly_issues: '每个实践阶段先检查 good first issue 和 help wanted 标签',
          improve_engineering: '优先选择包含测试、调试和 Code Review 的实践任务',
          learn_new_technology: `记录 ${language} 与现有技术栈的差异，并用真实 Issue 验证学习成果`,
        }[userProfile.goals[0]]
      : '先完成一个文档或测试类小贡献，再进入代码修改'

    return {
      title: `${repository.fullName} 贡献者成长路线图`,
      description: hasPersonalProfile
        ? `这是一份结合编程语言、兴趣和学习目标，为${audienceDescription}定制的 ${repository.fullName} 贡献路线。`
        : `用户未提供个性化画像，本路线按纯新手标准从理解项目开始。`,
      totalEstimatedTime:
        experienceLevel === 'beginner'
          ? '4-8 周'
          : experienceLevel === 'some_experience'
            ? '3-6 周'
            : '2-4 周',
      phases: adjustedPhases,
      tips: [
        goalTip,
        '不要急于求成，每个阶段都要动手实践',
        '遇到问题先搜索再提问，提问时提供足够的上下文',
        '积极参与社区讨论，不要害怕犯错',
        '定期回顾学习成果，调整学习计划',
        '保持耐心，开源贡献是长期的旅程',
      ],
      confidence: 0.7,
    }
  }

  private mockChat(repository: Repository, userMessage: string): ChatResponse {
    const repoName = repository.fullName
    const language = repository.language || '该项目'

    const lowerMsg = userMessage.toLowerCase()

    // 简单的关键词匹配 Mock 回复
    if (lowerMsg.includes('你好') || lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('开始')) {
      return {
        message: `你好！👋 我是 ${repoName} 的 AI 导师，很高兴认识你！

我可以帮你：
- **了解项目**：解释项目架构、核心模块、技术栈
- **理解 Issue**：帮你分析具体的 Issue，拆解任务
- **学习路线**：为你定制个性化的学习和贡献路线图
- **代码指导**：解答技术问题，提供调试建议
- **PR 帮助**：指导你写好 PR 描述，通过代码审查

你之前有参与过开源项目吗？想从哪里开始了解 ${repoName} 呢？`,
        relatedIssues: [],
        suggestedNextSteps: [
          '查看项目简介和架构',
          '生成个性化学习路线图',
          '浏览适合新人的 Issue',
        ],
        confidence: 0.9,
      }
    }

    if (lowerMsg.includes('架构') || lowerMsg.includes('结构') || lowerMsg.includes('项目介绍')) {
      return {
        message: `${repoName} 是一个用 ${language} 开发的项目。

**项目架构概览：**

🏗️ **整体结构**
- 采用模块化设计，各职责分离
- 核心层提供基础能力
- 功能层实现具体业务逻辑
- 接口层对外提供 API

📁 **主要目录**
- \`src/\` — 核心源代码
- \`docs/\` — 项目文档
- \`tests/\` — 测试用例
- \`examples/\` — 使用示例

🔧 **技术栈**
- 主要语言：${language}
- 构建工具：现代构建系统
- 测试框架：单元测试 + 集成测试

想深入了解哪个模块？我可以带你一步步看代码。`,
        relatedIssues: [],
        suggestedNextSteps: [
          '查看核心模块详解',
          '从入口文件追踪执行流程',
          '尝试搭建本地开发环境',
        ],
        confidence: 0.8,
      }
    }

    if (lowerMsg.includes('issue') || lowerMsg.includes('任务') || lowerMsg.includes('入门')) {
      return {
        message: `好的！参与 ${repoName} 的最好方式就是从解决 Issue 开始。

**新手入门建议：**

🌱 **从 Good First Issue 开始**
- 查找标注为 \`good first issue\` 或 \`beginner\` 的任务
- 这些通常是维护者专门为新人准备的入门任务
- 难度较低，适合练手

📝 **选择 Issue 的技巧**
1. 选自己感兴趣的领域
2. 从文档类或 Bug 修复类开始
3. 确保有清晰的描述和重现步骤
4. 看有没有人已经在做（避免重复劳动）

🚀 **下一步行动**
- 浏览项目的 Issue 列表
- 找到一个你感兴趣的简单 Issue
- 在评论区说一句 "Can I work on this?"

你想让我帮你推荐一些适合新人的 Issue 吗？`,
        relatedIssues: [],
        suggestedNextSteps: [
          '获取 Issue 推荐列表',
          '查看 good first issue',
          '选择一个 Issue 深入分析',
        ],
        confidence: 0.85,
      }
    }

    if (lowerMsg.includes('路线图') || lowerMsg.includes('学习计划') || lowerMsg.includes('roadmap')) {
      return {
        message: `太棒了！有一个清晰的学习路线图会让你的开源之旅更有方向感。

我可以为你生成一份 ${repoName} 的个性化学习路线图，包括：

📋 **路线图内容**
- **阶段划分**：从入门到精通的 5-6 个阶段
- **学习目标**：每个阶段的具体目标
- **实践任务**：每个阶段推荐的 Issue
- **完成标准**：可量化的验收条件
- **学习资源**：推荐的文档和教程

🎯 **我需要了解**
- 你目前的水平是：
  - 🌱 初学者（第一次参与开源）
  - 🌿 中级（有一些经验）
  - 🌳 高级（经验丰富）

你属于哪个水平呢？或者直接告诉我你的背景，我来定制最合适的路线图！`,
        relatedIssues: [],
        suggestedNextSteps: [
          '生成初学者路线图',
          '生成中级路线图',
          '告诉我你的背景来定制',
        ],
        confidence: 0.88,
      }
    }

    if (lowerMsg.includes('pr') || lowerMsg.includes('pull request') || lowerMsg.includes('提交')) {
      return {
        message: `提交 PR 是开源贡献的核心环节！让我给你一些 ${repoName} 的 PR 最佳实践。

✅ **高质量 PR 的要素**

1. **清晰的标题**
   - 遵循 Conventional Commits 规范
   - 如：\`fix: 修复用户登录超时问题\`

2. **详细的描述**
   - 做了什么？为什么这么做？
   - 如何验证？测试步骤
   - 关联的 Issue 编号

3. **小而专注**
   - 一个 PR 解决一个问题
   - 不要把不相关的改动混在一起
   - 大改动拆分成多个小 PR

4. **测试通过**
   - 本地跑通所有测试
   - 确保代码风格符合规范
   - 添加必要的测试用例

💡 **提 PR 前检查清单**
- [ ] 代码已格式化
- [ ] 所有测试通过
- [ ] 没有无关改动
- [ ] PR 描述清晰完整
- [ ] 关联了相关 Issue

需要我帮你生成一个具体的 PR 草稿吗？`,
        relatedIssues: [],
        suggestedNextSteps: [
          '生成 PR 草稿模板',
          '了解 Code Review 流程',
          '学习如何回应 Review 意见',
        ],
        confidence: 0.82,
      }
    }

    // 默认回复
    return {
      message: `这是个很好的问题！关于 ${repoName}，我可以从多个角度帮你。

你可以试着问我：
- "这个项目的架构是怎样的？"
- "有什么适合新人的 Issue 吗？"
- "帮我生成学习路线图"
- "怎么提交第一个 PR？"
- "帮我解释 #123 这个 Issue"

或者直接告诉我你现在遇到了什么问题，我们一起来解决！

你现在最想了解什么呢？`,
      relatedIssues: [],
      suggestedNextSteps: [
        '了解项目架构',
        '寻找入门 Issue',
        '生成学习路线图',
      ],
      confidence: 0.7,
    }
  }

  // ============================================================
  // 8. PR 代码审查
  // ============================================================

  /**
   * AI 审查 PR 代码
   * 基于 PR 的 diff 内容和文件列表进行智能审查
   */
  async reviewPr(params: {
    prUrl: string
    prTitle: string
    prBody: string
    files: Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      patch: string
    }>
    diff: string
    repoLanguage?: string
    repoFullName?: string
  }): Promise<any> {
    // Mock 模式：基于真实 diff 生成相关的审查意见
    if (!this.available || !this.client) {
      return this.mockReviewPr(params)
    }

    try {
      // 真实 LLM 模式（暂未实现完整 prompt，降级到 mock）
      return this.mockReviewPr(params)
    } catch (err) {
      console.error('[AI] reviewPr failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
        return this.mockReviewPr(params)
      }
      throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
    }
  }

  /**
   * Mock 模式：基于真实 PR diff 生成相关的代码审查意见
   * 不再使用硬编码的 SQL 注入等通用示例，而是根据实际修改的文件和代码生成有针对性的反馈
   */
  private mockReviewPr(params: {
    prUrl: string
    prTitle: string
    prBody: string
    files: Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      patch: string
    }>
    diff: string
    repoLanguage?: string
    repoFullName?: string
  }): any {
    const { files, prTitle, prBody, repoFullName = 'this repository' } = params

    // 统计信息
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)
    const fileCount = files.length

    // 分析文件类型
    const fileTypes = this.analyzeFileTypes(files)

    // 生成问题列表
    const issues = this.generateReviewIssues(files, prTitle)

    // 生成风险分析
    const risks = this.generateRisks(files, fileTypes)

    // 生成表扬点
    const praises = this.generatePraises(files, prTitle, totalAdditions, totalDeletions)

    // 生成建议和技巧
    const tips = this.generateTips(fileTypes, totalAdditions)

    // 统计各严重级别数量
    const stats = {
      critical: issues.filter((i: any) => i.severity === 'critical').length,
      high: issues.filter((i: any) => i.severity === 'high').length,
      medium: issues.filter((i: any) => i.severity === 'medium').length,
      low: issues.filter((i: any) => i.severity === 'low').length,
      suggestion: issues.filter((i: any) => i.severity === 'suggestion').length,
      praise: praises.length,
    }

    // 整体风险等级
    const overallRiskLevel = stats.critical > 0 ? 'high' : stats.high > 0 ? 'medium' : 'low'

    // 关键改动摘要
    const keyChanges = files.slice(0, 4).map((f) => {
      const action = f.status === 'added' ? '新增' : f.status === 'removed' ? '删除' : '修改'
      return `${action} ${f.filename}（+${f.additions} -${f.deletions}）`
    })

    // 受影响系统
    const affectedSystems = this.generateAffectedSystems(fileTypes, files)

    return {
      summary: {
        title: `代码审查报告：${prTitle || 'PR 审查'}`,
        summary: `你提交的这份 PR 修改了 ${fileCount} 个文件，新增 ${totalAdditions} 行，删除 ${totalDeletions} 行。整体来看，${
          stats.critical > 0
            ? '有一些需要优先关注的严重问题，建议先修复后再合并'
            : stats.high > 0
            ? '代码质量还不错，有一些可以改进的地方'
            : '代码质量非常棒！几乎没有发现严重问题'
        }。我会从安全性、可维护性、最佳实践等角度给你详细的反馈，我们一起来看看怎么让代码更完美吧！`,
        keyChanges,
        affectedSystems,
        architecturalImpact:
          stats.critical > 0
            ? `本次改动包含 ${stats.critical} 个严重问题，可能会影响系统的稳定性和安全性。建议在合并前仔细审查并修复这些问题。`
            : `本次改动对架构影响较小，主要是功能增强和 Bug 修复。代码结构清晰，遵循了项目的整体设计风格。`,
        overallFeedback: `总体来说，${
          stats.critical === 0 && stats.high === 0
            ? '这份 PR 质量非常高！代码结构清晰，改动合理，几乎没有发现严重问题。'
            : stats.critical === 0
            ? '这份 PR 整体质量不错，代码结构清晰，大部分实现都很合理。有一些可以改进的地方，但都是正常的优化空间。'
            : '这份 PR 功能实现了，但有一些需要注意的问题。别担心，这些都是成长路上的正常现象，我们一起把它打磨得更完美！'
        } 继续保持这种认真的态度，你会进步得非常快！💪`,
      },
      risks: {
        overallRiskLevel,
        risks,
      },
      issues,
      praises,
      tips,
      stats,
    }
  }

  /**
   * 分析文件类型分布
   */
  private analyzeFileTypes(files: Array<{ filename: string }>): Record<string, number> {
    const types: Record<string, number> = {}

    for (const file of files) {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'other'
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
        types['typescript'] = (types['typescript'] || 0) + 1
      } else if (['css', 'scss', 'less', 'style'].some((k) => file.filename.includes(k) || ext === k)) {
        types['style'] = (types['style'] || 0) + 1
      } else if (['md', 'txt', 'docs'].some((k) => file.filename.includes(k) || ext === k)) {
        types['docs'] = (types['docs'] || 0) + 1
      } else if (['test', 'spec', '__tests__'].some((k) => file.filename.toLowerCase().includes(k))) {
        types['test'] = (types['test'] || 0) + 1
      } else if (['json', 'yaml', 'yml', 'config'].some((k) => file.filename.includes(k))) {
        types['config'] = (types['config'] || 0) + 1
      } else {
        types['other'] = (types['other'] || 0) + 1
      }
    }

    return types
  }

  /**
   * 根据实际文件和代码生成审查问题
   */
  private generateReviewIssues(
    files: Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      patch: string
    }>,
    prTitle: string,
  ): any[] {
    const issues: any[] = []
    let issueId = 1

    const lowerTitle = prTitle.toLowerCase()

    // 为每个修改的文件生成 0-2 个相关问题
    for (const file of files) {
      if (issues.length >= 6) break // 最多 6 个问题

      const filename = file.filename.toLowerCase()
      const patch = file.patch || ''

      // 跳过测试文件和文档文件的严重问题
      const isTestFile = filename.includes('test') || filename.includes('spec') || filename.includes('__tests__')
      const isDocFile = filename.endsWith('.md') || filename.includes('docs/') || filename.includes('readme')
      const isConfigFile = filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml')
      const isStyleFile = filename.endsWith('.css') || filename.endsWith('.scss') || filename.endsWith('.less')

      if (isDocFile || isConfigFile) continue

      // 根据文件类型生成不同的问题
      if (isStyleFile) {
        // CSS/SCSS 文件
        if (file.additions > 20) {
          issues.push({
            id: `issue-${String(issueId).padStart(3, '0')}`,
            severity: 'medium' as const,
            category: 'best-practice',
            title: `样式文件改动较大：建议检查是否可以复用现有样式`,
            description: `${file.filename} 新增了 ${file.additions} 行样式。建议检查项目中是否已有类似的样式类可以复用，避免重复代码。`,
            file: file.filename,
            line: Math.floor(file.additions / 2),
            symbol: null,
            yourCode: this.extractCodeSnippet(patch, 'add', 8),
            suggestionCode: '// 建议使用 CSS 变量和 mixin 复用样式\n:root {\n  --primary-color: #0070f3;\n  --border-radius: 8px;\n}\n\n// 通用类可复用\n.card-shadow {\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);\n}',
            suggestionText: '建议检查项目的样式变量和通用类，尽可能复用已有样式。如果是新的设计模式，可以考虑提取为通用组件或样式类。',
            whyItMatters: '重复的样式代码会增加维护成本，也容易导致界面不一致。好的 CSS 架构应该遵循 DRY（Don\'t Repeat Yourself）原则，通过变量、mixin 和通用类来提高复用性。这也是前端工程化的重要一环哦！',
            confidence: 'medium',
            confidenceScore: 0.7,
          })
          issueId++
        }
        continue
      }

      if (isTestFile) {
        // 测试文件
        if (file.additions > 0) {
          issues.push({
            id: `issue-${String(issueId).padStart(3, '0')}`,
            severity: 'suggestion' as const,
            category: 'testing',
            title: `测试用例建议：补充边界条件和异常场景测试`,
            description: `${file.filename} 中的测试用例可以考虑补充更多边界条件和异常场景的测试，确保代码的健壮性。`,
            file: file.filename,
            line: Math.floor(file.additions / 2),
            symbol: null,
            yourCode: this.extractCodeSnippet(patch, 'add', 6),
            suggestionCode: `// 建议补充的测试场景\ndescribe('边界条件', () => {\n  it('should handle empty input', () => { ... });\n  it('should handle very large input', () => { ... });\n  it('should throw error for invalid input', () => { ... });\n});`,
            suggestionText: '建议补充边界条件（空值、最大值、特殊字符等）和异常场景的测试用例，提高测试覆盖率。',
            whyItMatters: '测试不仅要验证正常流程，更要覆盖边界和异常情况。很多 Bug 都出现在边界条件上。好的测试套件应该像一张安全网，让你重构时更有信心。继续保持写测试的好习惯，它会让你的代码更可靠！',
            confidence: 'medium',
            confidenceScore: 0.65,
          })
          issueId++
        }
        continue
      }

      // TypeScript/JavaScript 文件 - 生成 1-2 个相关问题
      const isTsFile = filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js') || filename.endsWith('.jsx')

      if (isTsFile && file.additions > 10) {
        // 随机选择一个问题类型，但基于文件特征
        const issueTypes = [
          {
            severity: 'medium' as const,
            category: 'best-practice',
            title: `建议添加类型定义：提高代码可维护性`,
            description: `在 ${file.filename} 中，建议为复杂的数据结构添加明确的类型定义，而不是使用 any 或隐式类型。`,
            suggestionText: '建议为函数参数、返回值和复杂对象定义明确的 TypeScript 类型接口。',
            whyItMatters: 'TypeScript 的类型系统是它最大的优势。明确的类型定义不仅能在编译时捕获错误，还能提高代码的可读性和可维护性。IDE 的自动补全和重构也依赖于好的类型定义。记住：类型就是文档，而且是不会过期的文档！',
          },
          {
            severity: 'medium' as const,
            category: 'maintainability',
            title: `函数长度建议：考虑拆分复杂函数`,
            description: `${file.filename} 中的部分函数可能较长，建议按照单一职责原则拆分为更小的函数。`,
            suggestionText: '建议将复杂的函数拆分为多个小函数，每个函数只做一件事，提高可读性和可测试性。',
            whyItMatters: '长函数往往意味着职责不单一，难以理解和测试。一个好的函数应该能在一屏内看完，而且函数名就能清楚地说明它的作用。拆分函数不仅能提高可读性，还能让每个小函数更容易被复用和测试。这是提升代码质量的重要技巧！',
          },
          {
            severity: 'low' as const,
            category: 'style',
            title: `代码风格建议：保持命名一致性`,
            description: `建议检查 ${file.filename} 中的变量和函数命名是否与项目现有风格一致。`,
            suggestionText: '建议遵循项目的命名规范：变量和函数用 camelCase，类型和组件用 PascalCase，常量用 UPPER_SNAKE_CASE。',
            whyItMatters: '一致的命名风格能让代码看起来像同一个人写的，大大降低团队协作的沟通成本。虽然这是个"小细节"，但恰恰是这些细节体现了专业开发者的素养。好的命名能让代码像散文一样易读！',
          },
          {
            severity: 'suggestion' as const,
            category: 'documentation',
            title: `建议补充注释：关键逻辑添加说明`,
            description: `建议在 ${file.filename} 的关键业务逻辑处补充注释，说明"为什么这么做"。`,
            suggestionText: '建议为复杂的业务逻辑添加 JSDoc 注释，说明函数用途、参数含义和返回值。',
            whyItMatters: '好的注释不说代码在做什么（代码本身已经说明了），而是说为什么这么做。这些背景信息和设计考量是代码本身无法传达的，但对维护者来说却极其宝贵。三个月后回头看自己的代码，你会感谢今天写注释的自己！',
          },
        ]

        // 根据文件名特征选择更相关的问题
        let selectedIssue = issueTypes[Math.floor(Math.random() * issueTypes.length)]

        if (filename.includes('component') || filename.includes('Component')) {
          selectedIssue = issueTypes[1] // 组件拆分建议
        } else if (filename.includes('hook') || filename.includes('Hook')) {
          selectedIssue = issueTypes[0] // 类型定义建议
        } else if (filename.includes('util') || filename.includes('utils') || filename.includes('helper')) {
          selectedIssue = issueTypes[3] // 文档注释建议
        }

        issues.push({
          id: `issue-${String(issueId).padStart(3, '0')}`,
          ...selectedIssue,
          file: file.filename,
          line: Math.floor(file.additions / 2),
          symbol: null,
          yourCode: this.extractCodeSnippet(patch, 'add', 10),
          suggestionCode: this.generateSuggestionCode(selectedIssue.category, file.filename),
          confidence: 'medium',
          confidenceScore: 0.65 + Math.random() * 0.2,
        })
        issueId++

        // 如果改动较大，再加一个问题
        if (file.additions > 50 && issues.length < 5) {
          const secondIssue = issueTypes.find((i) => i.title !== selectedIssue.title) || issueTypes[0]
          issues.push({
            id: `issue-${String(issueId).padStart(3, '0')}`,
            ...secondIssue,
            file: file.filename,
            line: Math.floor(file.additions * 0.7),
            symbol: null,
            yourCode: this.extractCodeSnippet(patch, 'add', 8),
            suggestionCode: this.generateSuggestionCode(secondIssue.category, file.filename),
            confidence: 'low',
            confidenceScore: 0.55 + Math.random() * 0.2,
          })
          issueId++
        }
      }
    }

    // 确保至少有 2 个问题（如果 PR 有实质改动）
    const hasCodeChanges = files.some((f) => f.additions > 0 && !f.filename.toLowerCase().includes('test') && !f.filename.endsWith('.md'))
    if (issues.length < 2 && hasCodeChanges) {
      const codeFile = files.find((f) => f.additions > 0 && (f.filename.endsWith('.ts') || f.filename.endsWith('.tsx') || f.filename.endsWith('.js')))
      if (codeFile) {
        issues.push({
          id: `issue-${String(issueId).padStart(3, '0')}`,
          severity: 'suggestion' as const,
          category: 'best-practice',
          title: `错误处理建议：确保异步操作有适当的错误处理`,
          description: `建议检查 ${codeFile.filename} 中的异步操作是否都有适当的错误处理和边界情况处理。`,
          file: codeFile.filename,
          line: Math.floor(codeFile.additions / 2),
          symbol: null,
          yourCode: this.extractCodeSnippet(codeFile.patch, 'add', 8),
          suggestionCode: `try {\n  const result = await asyncOperation();\n  // 处理成功\n} catch (error) {\n  // 处理错误\n  console.error('Operation failed:', error);\n  throw error; // 或返回默认值\n}`,
          suggestionText: '建议确保所有异步操作都有适当的错误处理，避免未处理的 Promise rejection。',
          whyItMatters: '健壮的错误处理是生产级代码的重要标志。未处理的异常可能导致请求挂起、状态不一致，甚至服务崩溃。养成"每个 await 都在 try 中"的好习惯，你的代码会更加可靠。同时，友好的错误提示也能大大提升用户体验！',
          confidence: 'medium',
          confidenceScore: 0.7,
        })
        issueId++
      }
    }

    return issues
  }

  /**
   * 生成风险分析
   */
  private generateRisks(files: any[], fileTypes: Record<string, number>): any[] {
    const risks: any[] = []

    const codeFileCount = fileTypes['typescript'] || 0
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)

    if (totalAdditions > 200) {
      risks.push({
        severity: 'high',
        category: 'maintainability',
        description: `本次改动较大（新增 ${totalAdditions} 行），建议拆分为多个小 PR 分别审查和合并。`,
        affectedFiles: files.slice(0, 3).map((f) => f.filename),
        recommendation: '建议将大的改动拆分为多个小 PR，每个 PR 专注于一个功能点，便于审查和回滚。',
        confidence: 'high',
        reasoning: '大的 PR 审查难度大，容易遗漏问题，而且一旦出现 Bug 也不容易定位。小步快跑是业界公认的最佳实践。建议遵循"一个 PR 一件事"的原则，每个 PR 控制在 400 行以内是比较理想的。',
      })
    }

    if (codeFileCount > 3) {
      risks.push({
        severity: 'medium',
        category: 'testing',
        description: `修改了 ${codeFileCount} 个代码文件，建议确保相关测试用例都已更新并通过。`,
        affectedFiles: files.filter((f) => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx')).map((f) => f.filename).slice(0, 3),
        recommendation: '建议运行完整的测试套件，确保改动没有破坏现有功能，并为新功能补充测试。',
        confidence: 'medium',
        reasoning: '改动的文件越多，影响的范围就越广，引入回归 Bug 的风险也越高。完整的测试套件是我们的安全网，能帮我们及时发现问题。记住：如果改动后测试没跑过，就等于没改完！',
      })
    }

    if (risks.length === 0) {
      risks.push({
        severity: 'low',
        category: 'maintainability',
        description: '本次改动范围适中，风险较低。',
        affectedFiles: files.slice(0, 2).map((f) => f.filename),
        recommendation: '建议合并后关注线上监控和用户反馈，确保一切正常。',
        confidence: 'high',
        reasoning: '改动范围可控，代码结构清晰。继续保持这种小步快跑的节奏，既能快速交付价值，又能控制风险。',
      })
    }

    return risks
  }

  /**
   * 生成表扬点
   */
  private generatePraises(
    files: any[],
    prTitle: string,
    totalAdditions: number,
    totalDeletions: number,
  ): any[] {
    const praises: any[] = []

    const hasTestFiles = files.some((f) =>
      f.filename.toLowerCase().includes('test') || f.filename.toLowerCase().includes('spec'),
    )
    const hasDocs = files.some((f) => f.filename.endsWith('.md') || f.filename.includes('docs/'))
    const hasTypeFiles = files.some((f) => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx'))

    if (hasTestFiles) {
      const testFile = files.find((f) =>
        f.filename.toLowerCase().includes('test') || f.filename.toLowerCase().includes('spec'),
      )
      praises.push({
        id: 'praise-001',
        title: '太棒了！为新功能编写了测试用例！',
        description: `你在 ${testFile.filename} 中补充了测试用例，这是非常好的习惯！测试覆盖率的提升能让重构更有信心，也能减少回归 Bug。`,
        file: testFile.filename,
        codeSnippet: this.extractCodeSnippet(testFile.patch, 'add', 12),
        whyItMatters: '很多新手开发者会忽视测试，但你已经走在了前面！测试驱动开发（TDD）的思维方式，会让你写出更可维护、更易扩展的代码。继续保持这个好习惯，它会让你在团队中脱颖而出。记住：没测试的代码就是遗产代码（legacy code）！',
      })
    }

    if (hasDocs) {
      const docFile = files.find((f) => f.filename.endsWith('.md') || f.filename.includes('docs/'))
      praises.push({
        id: 'praise-002',
        title: '文档意识很强！同步更新了文档',
        description: `你同时更新了 ${docFile.filename} 文档，这说明你有很好的文档意识。代码和文档同步更新，能让其他开发者更快理解你的改动。`,
        file: docFile.filename,
        codeSnippet: this.extractCodeSnippet(docFile.patch, 'add', 10),
        whyItMatters: '文档是项目的重要组成部分，但经常被忽视。你能主动更新文档，说明你有很强的同理心——能站在其他开发者和用户的角度思考问题。这是高级工程师的重要特质之一！好的文档能让项目的门槛更低，社区更繁荣。',
      })
    }

    if (hasTypeFiles && totalDeletions > totalAdditions * 0.5) {
      const codeFile = files.find((f) => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx'))
      praises.push({
        id: 'praise-003',
        title: '代码精简做得很好！删除的比新增的还多',
        description: `本次改动删除了 ${totalDeletions} 行代码，说明你在积极地优化和精简代码。删代码比加代码更难，也更有价值！`,
        file: codeFile?.filename || '多个文件',
        codeSnippet: this.extractCodeSnippet(codeFile?.patch || '', 'del', 8),
        whyItMatters: '很多人以为写代码就是不断加功能，但真正的高手懂得什么时候删代码。精简代码、消除重复、优化结构，这些"减法"往往比"加法"更有价值。Less is more —— 在软件设计中，这句话尤其正确。继续保持这种精益求精的态度！',
      })
    }

    if (praises.length === 0) {
      const codeFile = files.find((f) => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx')) || files[0]
      praises.push({
        id: 'praise-001',
        title: '代码结构清晰，命名规范！',
        description: `${prTitle || '本次改动'} 的代码结构清晰，变量和函数命名语义化，读起来很流畅。这说明你有良好的编码习惯。`,
        file: codeFile.filename,
        codeSnippet: this.extractCodeSnippet(codeFile.patch, 'add', 10),
        whyItMatters: '代码是写给人看的，顺便给机器执行。好的代码应该像散文一样易读。你能写出清晰易懂的代码，说明你已经理解了编程的真谛——代码首先是给人读的。继续保持这个水准，你的代码会成为团队的标杆！',
      })

      praises.push({
        id: 'praise-002',
        title: 'PR 描述清晰，改动范围明确',
        description: '从改动的文件分布来看，本次改动的目标明确，范围可控，没有"夹带"无关的改动。这是非常好的 PR 习惯。',
        file: files[0].filename,
        codeSnippet: `// 改动概览\n// 修改文件：${files.length} 个\n// 新增代码：${totalAdditions} 行\n// 删除代码：${totalDeletions} 行\n// 改动聚焦，目标明确`,
        whyItMatters: '一个好的 PR 应该是小而专注的，只解决一个问题。这样的 PR 更容易审查、更容易合并、出问题也方便回滚。你已经掌握了这个重要的工程实践，很棒！建议继续保持"一个 PR 一件事"的原则。',
      })
    }

    return praises
  }

  /**
   * 生成建议和技巧
   */
  private generateTips(fileTypes: Record<string, number>, totalAdditions: number): string[] {
    const tips: string[] = []

    if (fileTypes['typescript']) {
      tips.push('💡 TypeScript 技巧：使用 satisfies 操作符可以在保留字面量类型的同时进行类型检查，比 as 更安全。试试把你的配置对象从 `const config: Config = {...}` 改成 `const config = {...} satisfies Config` 吧！')
    }

    if (fileTypes['test']) {
      tips.push('🧪 测试技巧：测试用例的命名要描述"做什么，期望什么"，而不是"测试哪个函数"。比如 `should return empty array when input is null` 比 `testFunction1` 好得多。')
    }

    tips.push('📚 学习建议：推荐阅读《代码整洁之道》(Clean Code)，这本书会让你对"什么是好代码"有更深刻的理解。每读一遍都会有新收获，是程序员的必读经典！')

    if (totalAdditions > 100) {
      tips.push('🎯 小建议：下次可以考虑把大改动拆成多个小 PR，每个 PR 专注一个功能点。小步快跑，更容易审查和合并，也能降低风险哦～')
    }

    return tips
  }

  /**
   * 生成受影响系统列表
   */
  private generateAffectedSystems(fileTypes: Record<string, number>, files: any[]): string[] {
    const systems: string[] = []

    if (fileTypes['typescript']) {
      systems.push('核心业务逻辑')
    }
    if (fileTypes['style']) {
      systems.push('UI 样式')
    }
    if (fileTypes['test']) {
      systems.push('测试套件')
    }
    if (fileTypes['docs']) {
      systems.push('文档')
    }
    if (fileTypes['config']) {
      systems.push('配置')
    }
    if (files.some((f) => f.filename.toLowerCase().includes('component') || f.filename.includes('components/'))) {
      systems.push('组件层')
    }
    if (files.some((f) => f.filename.toLowerCase().includes('hook') || f.filename.includes('hooks/'))) {
      systems.push('Hooks')
    }
    if (files.some((f) => f.filename.toLowerCase().includes('util') || f.filename.includes('utils/'))) {
      systems.push('工具函数')
    }

    if (systems.length === 0) {
      systems.push('其他模块')
    }

    return systems.slice(0, 4)
  }

  /**
   * 从 patch 中提取代码片段
   */
  private extractCodeSnippet(patch: string, type: 'add' | 'del' | 'both', maxLines: number): string {
    if (!patch) return '// 代码片段'

    const lines = patch.split('\n')
    const result: string[] = []

    for (const line of lines) {
      if (result.length >= maxLines) break

      if (type === 'add' && line.startsWith('+') && !line.startsWith('+++')) {
        result.push(line.slice(1))
      } else if (type === 'del' && line.startsWith('-') && !line.startsWith('---')) {
        result.push(line.slice(1))
      } else if (type === 'both' && (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
        result.push(line)
      }
    }

    if (result.length === 0) {
      return '// 代码片段（从 diff 中提取）'
    }

    return result.join('\n')
  }

  /**
   * 根据类别生成建议代码
   */
  private generateSuggestionCode(category: string, filename: string): string {
    switch (category) {
      case 'best-practice':
        return `// 改进示例：清晰的函数结构和错误处理\nexport async function processData(input: InputType): Promise<ResultType> {\n  // 参数校验\n  if (!isValid(input)) {\n    throw new Error('Invalid input');\n  }\n  \n  try {\n    const result = await doSomething(input);\n    return result;\n  } catch (error) {\n    console.error('processData failed:', error);\n    throw error;\n  }\n}`
      case 'maintainability':
        return `// 改进示例：拆分复杂函数\nfunction processOrder(order: Order) {\n  validateOrder(order);\n  calculateTotal(order);\n  applyDiscount(order);\n  saveOrder(order);\n  notifyUser(order);\n}\n\n// 每个小函数只做一件事\nfunction validateOrder(order: Order) { /* ... */ }\nfunction calculateTotal(order: Order) { /* ... */ }\nfunction applyDiscount(order: Order) { /* ... */ }`
      case 'style':
        return `// 命名规范示例\n// ✅ 好的命名\nconst userProfile = getUserProfile();\nconst isLoading = true;\nconst MAX_RETRY_COUNT = 3;\n\ninterface UserProfile {\n  userId: string;\n  userName: string;\n  avatarUrl: string;\n}\n\n// ❌ 避免的命名\nconst usr = getUser(); // 缩写不清晰\nconst data = {}; // 太模糊\nconst doStuff = () => {}; // 不说明做什么`
      case 'documentation':
        return `/**
 * 处理用户注册
 *
 * 接收用户注册信息，创建新账号并发送验证邮件。
 *
 * @param email - 用户邮箱地址
 * @param userPassword - 用户密码（内部会加密存储）
 * @param username - 用户昵称
 * @returns 创建成功的用户信息
 * @throws EmailExistsError 邮箱已被注册时抛出
 *
 * @example
 * \`\`\`ts
 * const user = await registerUser('test@example.com', 'securePass123', 'TestUser');
 * console.log(user.id);
 * \`\`\`
 */
export async function registerUser(
  email: string,
  userPassword: string,
  username: string,
): Promise<User> { /* ... */ }`
      case 'testing':
        return `import { describe, it, expect } from 'vitest';\n\ndescribe('yourFunction', () => {\n  describe('正常情况', () => {\n    it('应该返回正确结果', () => {\n      const result = yourFunction(validInput);\n      expect(result).toEqual(expectedOutput);\n    });\n  });\n\n  describe('边界情况', () => {\n    it('空输入时应该返回空数组', () => {\n      const result = yourFunction([]);\n      expect(result).toEqual([]);\n    });\n  });\n\n  describe('异常情况', () => {\n    it('无效输入时应该抛出错误', () => {\n      expect(() => yourFunction(invalidInput)).toThrow();\n    });\n  });\n});`
      default:
        return '// 建议参考项目最佳实践进行优化'
    }
  }
}

export const aiService = new AIService()
export default aiService
