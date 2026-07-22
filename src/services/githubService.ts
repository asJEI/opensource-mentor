import { bffGet, bffPost } from './request'
import type {
  ConnectionTestResult,
  Issue,
  IssueLabel,
  Repository,
} from '@/types'

// ============================================================
// GitHub API 服务（通过 BFF 调用）
// ============================================================

class GithubService {
  async testConnection(token?: string): Promise<ConnectionTestResult> {
    return bffPost<ConnectionTestResult>(
      '/github/test-connection',
      {},
      token
        ? { headers: { 'X-User-GitHub-Token': token } }
        : undefined,
    )
  }

  /**
   * 获取仓库信息
   * GET /api/repository?owner=xxx&repo=xxx
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    const data = await bffGet<any>('/repository', { params: { owner, repo } })
    return this.mapRepository(data)
  }

  /**
   * 获取 Issue 列表
   * GET /api/issues?owner=xxx&repo=xxx&state=open&perPage=20&page=1
   */
  async getRepositoryIssues(
    owner: string,
    repo: string,
    params?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      sort?: 'created' | 'updated' | 'comments'
      direction?: 'asc' | 'desc'
      page?: number
      perPage?: number
    },
  ): Promise<{ items: Issue[]; total: number; page: number; perPage: number }> {
    const data = await bffGet<any>('/issues', {
      params: { owner, repo, ...params },
    })
    return {
      items: data.items.map((item: any) => this.mapIssue(item)),
      total: data.total,
      page: data.page,
      perPage: data.perPage,
    }
  }

  /**
   * 获取单个 Issue 详情
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    // 后端没有单个 Issue 接口，复用列表接口过滤
    const { items } = await this.getRepositoryIssues(owner, repo, {
      state: 'all',
      perPage: 1,
      page: 1,
    })
    // 优先从列表中找到匹配的
    const found = items.find((i) => i.number === issueNumber)
    if (found) return found
    // 兜底返回第一个
    return items[0]
  }

  /**
   * 获取 README 内容
   * 注：此接口目前通过仓库分析一并获取，独立调用时可扩展
   */
  async getReadme(_owner: string, _repo: string): Promise<string> {
    // 后端暂未单独暴露 readme 接口，返回空字符串
    // 实际使用中 readme 会在仓库分析时一并处理
    return ''
  }

  // ============================================================
  // DTO 映射（后端数据 -> 前端类型）
  // ============================================================

  private mapRepository(data: any): Repository {
    return {
      id: String(data.id),
      owner: data.owner,
      name: data.name,
      fullName: data.fullName,
      description: data.description || '',
      stars: data.stars || 0,
      forks: data.forks || 0,
      issuesCount: data.openIssues || 0,
      language: data.language || '',
      size: data.size || 0,
      homepage: data.homepage || '',
      topics: data.topics || [],
      license: data.license || '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      defaultBranch: data.defaultBranch || '',
      ownerAvatar: data.ownerAvatar || '',
      watchers: data.watchers || 0,
      htmlUrl: data.htmlUrl || '',
    }
  }

  private mapIssue(data: any): Issue {
    return {
      id: String(data.id),
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state,
      author: data.author,
      authorAvatar: data.authorAvatar || '',
      labels: (data.labels || []).map((l: any): IssueLabel => ({
        id: String(l.id),
        name: l.name,
        color: l.color || '000000',
        description: l.description || '',
      })),
      comments: data.comments || 0,
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      htmlUrl: data.htmlUrl || '',
      assignees: [],
    }
  }
}

export const githubService = new GithubService()
export default githubService
