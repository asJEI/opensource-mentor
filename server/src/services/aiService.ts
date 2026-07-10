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
} from '../types'
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

  // ============================================================
  // 1. Issue 解释
  // ============================================================

  async explainIssue(repository: Repository, issue: Issue): Promise<IssueExplain> {
    if (!this.available || !this.client) {
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

      const content = await this.callLLM(prompt)
      const parsed = this.parseJsonSafely(content)
      return this.validateExplainResult(parsed)
    } catch (err) {
      console.error('[AI] explainIssue failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
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
    if (!this.available || !this.client) {
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

      const content = await this.callLLM(prompt)
      const parsed = this.parseJsonSafely(content)
      return this.validateRepoAnalysisResult(parsed)
    } catch (err) {
      console.error('[AI] analyzeRepository failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
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
  ): Promise<IssueRecommendation> {
    if (!this.available || !this.client) {
      return this.mockRecommendIssues(repository, issues)
    }

    try {
      const prompt = issueRecommendationPrompt({
        repoName: repository.fullName,
        repoLanguage: repository.language,
        repoDescription: repository.description,
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

      const content = await this.callLLM(prompt)
      const parsed = this.parseJsonSafely(content)
      return this.validateRecommendationResult(parsed, issues)
    } catch (err) {
      console.error('[AI] recommendIssues failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
        return this.mockRecommendIssues(repository, issues)
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
    if (!this.available || !this.client) {
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

      const content = await this.callLLM(prompt)
      const parsed = this.parseJsonSafely(content)
      return this.validatePrDraftResult(parsed, issue)
    } catch (err) {
      console.error('[AI] generatePrDraft failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
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
    userLevel: 'beginner' | 'intermediate' | 'advanced'
    goodFirstIssues: Issue[]
  }): Promise<Roadmap> {
    const { repository, readme, userLevel, goodFirstIssues } = params

    if (!this.available || !this.client) {
      return this.mockGenerateRoadmap(repository, userLevel, goodFirstIssues)
    }

    try {
      const prompt = roadmapPrompt({
        repoName: repository.fullName,
        repoDescription: repository.description,
        repoLanguage: repository.language,
        repoTopics: repository.topics,
        stars: repository.stars,
        userLevel,
        readme,
        goodFirstIssues: goodFirstIssues.map((i) => ({
          number: i.number,
          title: i.title,
          labels: i.labels.map((l) => l.name),
        })),
      })

      const content = await this.callLLM(prompt, 0.8)
      const parsed = this.parseJsonSafely(content)
      return this.validateRoadmapResult(parsed)
    } catch (err) {
      console.error('[AI] generateRoadmap failed:', (err as Error).message)
      if (config.nodeEnv === 'development') {
        return this.mockGenerateRoadmap(repository, userLevel, goodFirstIssues)
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

    if (!this.available || !this.client) {
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

      const { data } = await this.client.post('/chat/completions', {
        model: config.llm.model,
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
      if (config.nodeEnv === 'development') {
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
  private async callLLM(userPrompt: string, temperature = 0.7): Promise<string> {
    const { data } = await this.client!.post('/chat/completions', {
      model: config.llm.model,
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
  ): IssueRecommendation {
    const items = (parsed.items as unknown[]) || []

    const scoredIssues: RecommendedIssue[] = items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const index = Number(item.index)
        const originalIssue = issues[index] || issues[0]
        const matchDetails = (item.matchDetails as Record<string, unknown>) || {}

        return {
          ...originalIssue,
          recommendationScore: Number(item.recommendationScore) || 50,
          confidence: Number(item.confidence) || 0.6,
          recommendationReasons: this.ensureStringArray(item.recommendationReasons),
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
      summary: String(parsed.summary || '已为你筛选出适合新人的 Issue'),
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
  ): IssueRecommendation {
    const scored = issues.map((issue, index) => {
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

      let score = 50
      if (hasGoodFirstLabel) score += 25
      if (hasDocLabel) score += 15
      if (hasHelpLabel) score += 10
      if (hasBugLabel) score += 5
      if (isRecent) score += 5
      if (hasComments) score += 5
      score = Math.min(100, Math.max(0, score + (index % 5) * 2 - 4))

      const reasons: string[] = []
      if (hasGoodFirstLabel) reasons.push('标有 good first issue 标签，官方推荐新人入手')
      if (hasDocLabel) reasons.push('文档类改动，门槛较低，适合新人')
      if (hasHelpLabel) reasons.push('维护者标记为需要帮助，欢迎贡献')
      if (isRecent) reasons.push('近期有更新，活跃度较高')
      if (hasComments) reasons.push('有讨论记录，可以参考其他人的思路')
      if (reasons.length === 0) reasons.push('难度适中，有学习价值')

      return {
        ...issue,
        recommendationScore: score,
        confidence: 0.65,
        recommendationReasons: reasons,
        matchDetails: {
          difficultyMatch: hasGoodFirstLabel || hasDocLabel ? 85 : 60,
          skillMatch: hasDocLabel ? 90 : 65,
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
      summary: `已从 ${issues.length} 个 Issue 中为你筛选出适合新人入手的任务，优先推荐标有 good first issue 和文档类的 Issue。`,
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
    userLevel: 'beginner' | 'intermediate' | 'advanced',
    goodFirstIssues: Issue[],
  ): Roadmap {
    const language = repository.language || 'JavaScript'
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

    // 根据用户水平调整起点
    let startIdx = 0
    if (userLevel === 'intermediate') startIdx = 2
    if (userLevel === 'advanced') startIdx = 4

    const adjustedPhases = phases.slice(startIdx).map((p, i) => ({
      ...p,
      phase: i + 1,
    }))

    return {
      title: `${repository.fullName} 贡献者成长路线图`,
      description: `这是一份专为 ${userLevel === 'beginner' ? '开源新手' : userLevel === 'intermediate' ? '有一定经验的开发者' : '资深开发者'} 定制的 ${repository.fullName} 项目学习路线图，从项目认知到成为活跃贡献者，循序渐进。`,
      totalEstimatedTime: userLevel === 'beginner' ? '4-8 周' : userLevel === 'intermediate' ? '3-6 周' : '2-4 周',
      phases: adjustedPhases,
      tips: [
        '不要急于求成，每个阶段都要动手实践',
        '遇到问题先搜索再提问，提问时提供足够的上下文',
        '积极参与社区讨论，不要害怕犯错',
        '定期回顾学习成果，调整学习计划',
        '帮助新人是最好的学习方式',
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
}

export const aiService = new AIService()
export default aiService
