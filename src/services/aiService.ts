import { bffPost } from './request'
import type {
  Issue,
  Repository,
  IssueExplain,
  ChatMessage,
  PrDraft,
  Roadmap,
  RepoAnalysis,
  IssueRecommendation,
  ChatResponse,
} from '@/types'

// ============================================================
// AI 服务（通过 BFF 调用）
// ============================================================

class AiService {
  /**
   * AI 解释 Issue
   * POST /api/ai/explain
   */
  async explainIssue(issue: Issue, repo: Repository): Promise<IssueExplain> {
    const data = await bffPost<any>('/ai/explain', {
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
    })
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
    const data = await bffPost<any>('/ai/analyze-repo', { owner, repo })
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
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      perPage?: number
      page?: number
    },
  ): Promise<IssueRecommendation> {
    const data = await bffPost<any>('/ai/recommend-issues', {
      owner,
      repo,
      ...params,
    })
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
    const data = await bffPost<any>('/ai/generate-pr', {
      owner,
      repo,
      issueNumber,
      prType,
      additionalContext,
    })
    return this.mapPrDraft(data)
  }

  /**
   * AI 生成学习路线图
   * POST /api/ai/generate-roadmap
   */
  async generateRoadmap(
    owner: string,
    repo: string,
    userLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
  ): Promise<Roadmap> {
    const data = await bffPost<any>('/ai/generate-roadmap', {
      owner,
      repo,
      userLevel,
    })
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
  ): Promise<ChatResponse> {
    const data = await bffPost<any>('/ai/chat', {
      owner,
      repo,
      message,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
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
      knowledge: data.knowledge || [],
      steps: data.steps || [],
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
        recommendationScore: item.recommendationScore || 0,
        confidence: item.confidence || 0.5,
        recommendationReasons: item.recommendationReasons || [],
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

  private mapRoadmap(data: any): Roadmap {
    return {
      title: data.title || '',
      description: data.description || '',
      totalEstimatedTime: data.totalEstimatedTime || '',
      phases: (data.phases || []).map((phase: any, idx: number) => ({
        id: `phase-${idx}`,
        phase: phase.phase || idx + 1,
        title: phase.title || '',
        goal: phase.goal || '',
        learningItems: phase.learningItems || [],
        recommendedIssues: phase.recommendedIssues || [],
        estimatedDuration: phase.estimatedDuration || '',
        difficulty: phase.difficulty || 'medium',
        completionCriteria: phase.completionCriteria || [],
        resources: phase.resources || [],
        // 前端扩展字段
        status: idx === 0 ? 'current' : 'pending',
        tasks: (phase.learningItems || []).map((item: string, ti: number) => ({
          id: `task-${idx}-${ti}`,
          text: item,
          completed: false,
        })),
      })),
      tips: data.tips || [],
      confidence: data.confidence || 0.7,
    }
  }
}

export const aiService = new AiService()
export default aiService
