import { ApiError } from '../http'
import { GitHubClient } from './client'
import type {
  GitHubSearchIssuesResultDto,
  IssueDto,
  IssueListParams,
  RepositoryDto,
} from './types'

export interface PullRequestFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch: string
  raw_url: string
}

export class GitHubService {
  constructor(private readonly client: GitHubClient) {}

  async testConnection(): Promise<{
    login: string
    name: string | null
    avatarUrl: string
  }> {
    const { data } = await this.client.getJson<{
      login: string
      name: string | null
      avatar_url?: string
    }>('/user')
    return {
      login: data.login,
      name: data.name || null,
      avatarUrl: data.avatar_url || '',
    }
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryDto> {
    const { data } = await this.client.getJson<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    )
    return mapRepository(data)
  }

  async getIssues(
    owner: string,
    repo: string,
    params: IssueListParams = {},
  ): Promise<{ items: IssueDto[]; total: number }> {
    const state = params.state ?? 'open'
    const sort = params.sort ?? 'created'
    const direction = params.direction ?? 'desc'
    const page = params.page ?? 1
    const perPage = params.perPage ?? 20

    const { data, headers } = await this.client.getJson<Array<Record<string, unknown>>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        query: {
          state,
          sort,
          direction,
          page,
          per_page: perPage,
          labels: params.labels,
        },
      },
    )

    const issues = data
      .filter((item) => !item.pull_request)
      .map((item) => mapIssue(item))

    const linkHeader = headers.get('link') || ''
    let total = issues.length
    const lastMatch = linkHeader.match(/[?&]page=(\d+)>; rel="last"/)
    if (lastMatch) {
      total = Number(lastMatch[1]) * perPage
    }

    return { items: issues, total }
  }

  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueDto> {
    const { data } = await this.client.getJson<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
    )
    return mapIssue(data)
  }

  async searchIssues(
    query: string,
    params: {
      sort?: 'created' | 'updated' | 'comments'
      order?: 'asc' | 'desc'
      perPage?: number
      page?: number
    } = {},
  ): Promise<GitHubSearchIssuesResultDto> {
    const { data, headers } = await this.client.getJson<{
      total_count?: number
      incomplete_results?: boolean
      items?: Array<Record<string, unknown>>
    }>('/search/issues', {
      query: {
        q: query,
        sort: params.sort ?? 'updated',
        order: params.order ?? 'desc',
        per_page: params.perPage ?? 30,
        page: params.page ?? 1,
      },
    })

    const reset = headers.get('x-ratelimit-reset')
    const rateLimitReset = reset ? Number(reset) : undefined

    return {
      totalCount: data.total_count ?? 0,
      incompleteResults: Boolean(data.incomplete_results),
      items: Array.isArray(data.items)
        ? data.items.map((item) => mapSearchIssue(item))
        : [],
      rateLimitReset:
        rateLimitReset && Number.isFinite(rateLimitReset)
          ? rateLimitReset
          : undefined,
    }
  }

  /** Returns README raw text; empty string when missing. */
  async getReadme(owner: string, repo: string): Promise<string> {
    try {
      const { data } = await this.client.getJson<string>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
        { accept: 'application/vnd.github.v3.raw' },
      )
      return typeof data === 'string' ? data : JSON.stringify(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return ''
      }
      throw error
    }
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<Record<string, unknown>> {
    const { data } = await this.client.getJson<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`,
    )
    return data
  }

  async getPullRequestDiff(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<string> {
    const { data } = await this.client.getJson<string>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`,
      { accept: 'application/vnd.github.v3.diff' },
    )
    return typeof data === 'string' ? data : JSON.stringify(data)
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{ files: PullRequestFile[] }> {
    const { data } = await this.client.getJson<
      Array<Record<string, unknown>>
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/files`,
    )
    return {
      files: data.map((file) => this.mapPullRequestFile(file)),
    }
  }

  /**
   * Compare base...head on the upstream repo.
   * For fork branches, head should be `forkOwner:branch`.
   * @see https://docs.github.com/en/rest/commits/commits#compare-two-commits
   */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{
    status: string
    aheadBy: number
    behindBy: number
    totalCommits: number
    htmlUrl: string
    files: PullRequestFile[]
    commits: Array<{ sha: string; message: string; author: string }>
  }> {
    const baseEncoded = encodeURIComponent(base)
    const headEncoded = encodeURIComponent(head)
    const { data } = await this.client.getJson<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${baseEncoded}...${headEncoded}`,
    )
    const files = Array.isArray(data.files)
      ? data.files.map((file) =>
          this.mapPullRequestFile(file as Record<string, unknown>),
        )
      : []
    const commits = Array.isArray(data.commits)
      ? data.commits.map((item) => {
          const commit = item as Record<string, unknown>
          const meta = (commit.commit as Record<string, unknown>) || {}
          const author = (meta.author as Record<string, unknown>) || {}
          return {
            sha: String(commit.sha || '').slice(0, 7),
            message: String(meta.message || '').split('\n')[0] || '',
            author: String(author.name || ''),
          }
        })
      : []
    return {
      status: String(data.status || ''),
      aheadBy: Number(data.ahead_by) || 0,
      behindBy: Number(data.behind_by) || 0,
      totalCommits: Number(data.total_commits) || commits.length,
      htmlUrl: String(data.html_url || ''),
      files,
      commits,
    }
  }

  async compareCommitsDiff(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<string> {
    const baseEncoded = encodeURIComponent(base)
    const headEncoded = encodeURIComponent(head)
    const { data } = await this.client.getJson<string>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${baseEncoded}...${headEncoded}`,
      { accept: 'application/vnd.github.v3.diff' },
    )
    return typeof data === 'string' ? data : JSON.stringify(data)
  }

  /**
   * List branch names for a repository (paginated, capped).
   */
  async listBranches(
    owner: string,
    repo: string,
    options?: { maxPages?: number; perPage?: number },
  ): Promise<string[]> {
    const perPage = Math.min(Math.max(options?.perPage ?? 100, 1), 100)
    const maxPages = Math.min(Math.max(options?.maxPages ?? 3, 1), 5)
    const names: string[] = []
    const seen = new Set<string>()

    for (let page = 1; page <= maxPages; page += 1) {
      const { data } = await this.client.getJson<
        Array<Record<string, unknown>>
      >(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
        { query: { per_page: perPage, page } },
      )
      if (!Array.isArray(data) || data.length === 0) break
      for (const item of data) {
        const name = String(item.name || '').trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        names.push(name)
      }
      if (data.length < perPage) break
    }

    return names
  }

  private mapPullRequestFile(file: Record<string, unknown>): PullRequestFile {
    return {
      filename: String(file.filename || ''),
      status: String(file.status || ''),
      additions: Number(file.additions) || 0,
      deletions: Number(file.deletions) || 0,
      changes: Number(file.changes) || 0,
      patch: typeof file.patch === 'string' ? file.patch : '',
      raw_url: typeof file.raw_url === 'string' ? file.raw_url : '',
    }
  }

  parsePrUrl(
    prUrl: string,
  ): { owner: string; repo: string; pullNumber: number } | null {
    try {
      const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
      if (!match) return null
      return {
        owner: match[1],
        repo: match[2],
        pullNumber: Number.parseInt(match[3], 10),
      }
    } catch {
      return null
    }
  }

  async getRawFile(
    owner: string,
    repo: string,
    path: string,
  ): Promise<string> {
    try {
      const { data } = await this.client.getJson<string>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        { accept: 'application/vnd.github.v3.raw' },
      )
      return typeof data === 'string' ? data : JSON.stringify(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return ''
      }
      throw error
    }
  }

  async getRepositoryTree(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<Array<{ path: string; type: 'blob' | 'tree' }>> {
    if (!branch) return []
    try {
      const { data } = await this.client.getJson<{
        tree?: Array<{ path?: string; type?: string }>
      }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}`,
        { query: { recursive: 1 } },
      )
      return (data.tree || [])
        .filter((item) => item.path && (item.type === 'blob' || item.type === 'tree'))
        .map((item) => ({
          path: String(item.path),
          type: item.type as 'blob' | 'tree',
        }))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return []
      }
      throw error
    }
  }
}

function mapRepository(data: Record<string, any>): RepositoryDto {
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    owner: data.owner?.login ?? '',
    ownerAvatar: data.owner?.avatar_url ?? '',
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    watchers: data.watchers_count ?? 0,
    openIssues: data.open_issues_count ?? 0,
    language: data.language ?? null,
    topics: data.topics || [],
    license: data.license?.spdx_id || data.license?.name || null,
    homepage: data.homepage || null,
    defaultBranch: data.default_branch ?? '',
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? '',
    size: data.size ?? 0,
    htmlUrl: data.html_url ?? '',
  }
}

function mapIssue(data: Record<string, any>): IssueDto {
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    state: data.state as 'open' | 'closed',
    author: data.user?.login ?? '',
    authorAvatar: data.user?.avatar_url ?? '',
    labels: (data.labels || []).map((label: Record<string, any>) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description ?? null,
    })),
    comments: data.comments ?? 0,
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? '',
    htmlUrl: data.html_url ?? '',
  }
}

function mapSearchIssue(data: Record<string, any>) {
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    state: data.state as 'open' | 'closed',
    htmlUrl: data.html_url ?? '',
    comments: data.comments ?? 0,
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? '',
    repositoryUrl: data.repository_url ?? '',
    pullRequest: data.pull_request,
    assignee: data.assignee
      ? {
          login: data.assignee.login ?? '',
          avatarUrl: data.assignee.avatar_url ?? '',
        }
      : null,
    assignees: (data.assignees || []).map((assignee: Record<string, any>) => ({
      login: assignee.login ?? '',
      avatarUrl: assignee.avatar_url ?? '',
    })),
    labels: (data.labels || []).map((label: Record<string, any>) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description ?? null,
    })),
    user: {
      login: data.user?.login ?? '',
      avatarUrl: data.user?.avatar_url ?? '',
    },
  }
}
