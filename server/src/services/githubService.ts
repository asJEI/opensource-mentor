import axios, { AxiosInstance, AxiosError } from 'axios'
import { config } from '../config'
import { Repository, Issue, IssueLabel } from '../types'
import {
  GitHubError,
  RepositoryNotFoundError,
  RateLimitError,
  AppError,
} from '../utils/errors'

/**
 * GitHub API 服务层
 * 负责所有与 GitHub REST API 的交互
 * 统一封装 DTO 转换和错误处理
 */
class GitHubService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.github.baseUrl,
      timeout: 15000,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'OpenSource-Mentor-BFF',
      },
    })

    // 请求拦截器：添加 Token
    this.client.interceptors.request.use((requestConfig) => {
      if (config.github.token) {
        requestConfig.headers.Authorization = `Bearer ${config.github.token}`
      }
      return requestConfig
    })

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw this.handleError(error)
      },
    )
  }

  /**
   * 获取仓库信息
   * GET /repos/{owner}/{repo}
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    const { data } = await this.client.get(`/repos/${owner}/${repo}`)
    return this.mapRepository(data)
  }

  /**
   * 获取 Issue 列表
   * GET /repos/{owner}/{repo}/issues
   *
   * 注意：GitHub API 中 Issue 列表包含 PR，需要过滤
   */
  async getIssues(
    owner: string,
    repo: string,
    params: {
      state?: 'open' | 'closed' | 'all'
      labels?: string
      sort?: 'created' | 'updated' | 'comments'
      direction?: 'asc' | 'desc'
      page?: number
      perPage?: number
    } = {},
  ): Promise<{ items: Issue[]; total: number }> {
    const {
      state = 'open',
      labels,
      sort = 'created',
      direction = 'desc',
      page = 1,
      perPage = 20,
    } = params

    const queryParams: Record<string, string | number> = {
      state,
      sort,
      direction,
      page,
      per_page: perPage,
    }

    if (labels) {
      queryParams.labels = labels
    }

    const { data, headers } = await this.client.get(`/repos/${owner}/${repo}/issues`, {
      params: queryParams,
    })

    // 过滤掉 PR
    const issues = data
      .filter((item: { pull_request?: unknown }) => !item.pull_request)
      .map((item: any): Issue => this.mapIssue(item))

    // 从 Link header 解析总页数，估算总数
    const linkHeader = headers.link || ''
    let total = issues.length
    const lastMatch = linkHeader.match(/[?&]page=(\d+)>; rel="last"/)
    if (lastMatch) {
      total = Number(lastMatch[1]) * perPage
    }

    return { items: issues, total }
  }

  /**
   * 获取单个 Issue
   * GET /repos/{owner}/{repo}/issues/{issue_number}
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    const { data } = await this.client.get(`/repos/${owner}/${repo}/issues/${issueNumber}`)
    return this.mapIssue(data)
  }

  /**
   * 获取 README 内容
   * GET /repos/{owner}/{repo}/readme
   */
  async getReadme(owner: string, repo: string): Promise<string> {
    try {
      const { data } = await this.client.get(`/repos/${owner}/${repo}/readme`, {
        headers: { Accept: 'application/vnd.github.v3.raw' },
      })
      return typeof data === 'string' ? data : JSON.stringify(data)
    } catch (err) {
      // README 不存在时返回空字符串，不抛出错误
      if (err instanceof AppError && err.code === 404) {
        return ''
      }
      throw err
    }
  }

  /**
   * 获取 PR 信息
   * GET /repos/{owner}/{repo}/pulls/{pull_number}
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any> {
    const { data } = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`)
    return data
  }

  /**
   * 获取 PR diff 内容
   * GET /repos/{owner}/{repo}/pulls/{pull_number}
   * Accept: application/vnd.github.v3.diff
   */
  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    const { data } = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: { Accept: 'application/vnd.github.v3.diff' },
    })
    return typeof data === 'string' ? data : JSON.stringify(data)
  }

  /**
   * 获取 PR 文件列表
   * GET /repos/{owner}/{repo}/pulls/{pull_number}/files
   */
  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<{
    files: Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      changes: number
      patch: string
      raw_url: string
    }>
  }> {
    const { data } = await this.client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`)
    return { files: data }
  }

  /**
   * 从 PR URL 解析 owner, repo, pullNumber
   */
  parsePrUrl(prUrl: string): { owner: string; repo: string; pullNumber: number } | null {
    try {
      const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          pullNumber: parseInt(match[3], 10),
        }
      }
      return null
    } catch {
      return null
    }
  }

  // ============ DTO 映射 ============

  /**
   * 仓库信息 DTO 转换
   * 将 GitHub 原始数据转换为前端需要的格式
   */
  private mapRepository(data: any): Repository {
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner.login,
      ownerAvatar: data.owner.avatar_url,
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      topics: data.topics || [],
      license: data.license?.spdx_id || data.license?.name || null,
      homepage: data.homepage || null,
      defaultBranch: data.default_branch,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      size: data.size,
      htmlUrl: data.html_url,
    }
  }

  /**
   * Issue DTO 转换
   */
  private mapIssue(data: any): Issue {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state as 'open' | 'closed',
      author: data.user.login,
      authorAvatar: data.user.avatar_url,
      labels: data.labels.map((label: any): IssueLabel => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
      comments: data.comments,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      htmlUrl: data.html_url,
    }
  }

  // ============ 错误处理 ============

  /**
   * 统一处理 GitHub API 错误
   */
  private handleError(error: AxiosError): Error {
    const response = error.response
    const status = response?.status
    const data = response?.data as any

    // 仓库不存在
    if (status === 404) {
      const url = error.config?.url || ''
      const match = url.match(/\/repos\/([^/]+)\/([^/]+)/)
      if (match) {
        return new RepositoryNotFoundError(match[1], match[2])
      }
      return new GitHubError('资源不存在', 404, {
        githubErrorCode: 'NOT_FOUND',
        details: data,
      })
    }

    // Rate Limit
    if (status === 403) {
      const headers = response?.headers as Record<string, string> | undefined
      const remaining = headers?.['x-ratelimit-remaining']
      const reset = headers?.['x-ratelimit-reset']

      // 检查是否是 rate limit 错误
      const isRateLimit =
        remaining === '0' ||
        data?.message?.toLowerCase().includes('rate limit') ||
        data?.message?.toLowerCase().includes('abuse rate')

      if (isRateLimit) {
        return new RateLimitError(reset ? Number(reset) : undefined)
      }

      return new GitHubError(data?.message || 'GitHub API 访问被拒绝', 403, {
        githubErrorCode: 'FORBIDDEN',
        details: data,
      })
    }

    // 未授权（Token 无效）
    if (status === 401) {
      return new GitHubError('GitHub Token 无效或已过期', 401, {
        githubErrorCode: 'BAD_CREDENTIALS',
        details: data,
      })
    }

    // 网络错误
    if (!response) {
      return new GitHubError(`网络错误：${error.message}`, 502, {
        githubErrorCode: 'NETWORK_ERROR',
      })
    }

    // 其他 GitHub 错误
    return new GitHubError(
      data?.message || `GitHub API 请求失败 (${status})`,
      status || 502,
      {
        githubErrorCode: data?.documentation_url || 'UNKNOWN',
        details: data,
      },
    )
  }
}

export const githubService = new GitHubService()
export default githubService
