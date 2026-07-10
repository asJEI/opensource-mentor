import { githubService } from './githubService'
import { aiService } from './aiService'
import type {
  RepoAnalysis,
  Repository,
  IssueRecommendation,
  IssueExplain,
  RecommendedIssue,
} from '@/types'

// ============================================================
// 仓库分析服务（业务层，组合 GitHub + AI）
// ============================================================

class RepositoryService {
  /**
   * 分析仓库（组合 GitHub 数据 + AI 分析）
   * 调用后端 /api/ai/analyze-repo
   */
  async analyzeRepository(
    owner: string,
    name: string,
  ): Promise<{ repository: Repository; analysis: RepoAnalysis }> {
    return aiService.analyzeRepository(owner, name)
  }

  /**
   * 获取推荐 Issue 列表
   * 调用后端 /api/ai/recommend-issues
   */
  async getRecommendedIssues(
    owner: string,
    name: string,
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      perPage?: number
      page?: number
    },
  ): Promise<RecommendedIssue[]> {
    const result: IssueRecommendation = await aiService.recommendIssues(owner, name, params)
    return result.items
  }

  /**
   * 获取 Issue 解释
   * 调用后端 /api/ai/explain
   * 直接使用已有的 Issue 数据，无需重新获取
   */
  async getIssueExplain(
    owner: string,
    name: string,
    issue: { number: number; title: string; body: string | null; labels: { name: string; color?: string }[] },
  ): Promise<IssueExplain> {
    const repo = await githubService.getRepository(owner, name)
    return aiService.explainIssue(issue as any, repo)
  }

  /**
   * 获取仓库基础信息
   */
  async getRepository(owner: string, name: string): Promise<Repository> {
    return githubService.getRepository(owner, name)
  }

  /**
   * 获取 Issue 列表（不带 AI 推荐）
   */
  async getIssues(
    owner: string,
    name: string,
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      page?: number
      perPage?: number
    },
  ): Promise<{ items: RecommendedIssue[]; total: number; page: number; perPage: number }> {
    const result = await githubService.getRepositoryIssues(owner, name, params)
    return {
      items: result.items.map((item) => ({
        ...item,
        recommendationScore: 0,
        confidence: 0,
        recommendationReasons: [],
        matchDetails: {
          difficultyMatch: 50,
          skillMatch: 50,
          impactScore: 50,
          activityScore: 50,
          beginnerFriendlyScore: 50,
        },
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
    }
  }
}

export const repositoryService = new RepositoryService()
export default repositoryService
