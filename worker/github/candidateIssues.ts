import { readSession } from '../auth/session'
import { readCurrentUser } from '../auth/userPersistence'
import type { PlatformEnv } from '../config'
import { ApiError, success } from '../http'
import { createGitHubService } from './factory'
import type { GitHubSearchIssueItemDto } from './types'

const TARGET_MIN_CANDIDATES = 30
const TARGET_MAX_CANDIDATES = 80
const PER_QUERY_LIMIT = 20
const MAX_TECHNOLOGIES = 4
const MIN_BODY_LENGTH = 100
const RECENT_UPDATE_DAYS = 180

type CandidateIssue = {
  id: number
  issueNumber: number
  title: string
  body: string
  issueUrl: string
  repository: {
    owner: string
    name: string
    fullName: string
    url: string
  }
  labels: string[]
  language: string | null
  languageSource: 'query' | 'unknown'
  state: 'open' | 'closed'
  comments: number
  assignee: { login: string; avatarUrl: string } | null
  assignees: Array<{ login: string; avatarUrl: string }>
  createdAt: string
  updatedAt: string
  user: {
    login: string
    avatarUrl: string
  }
}

type CandidateIssuesMeta = {
  queries: string[]
  rawCount: number
  deduplicatedCount: number
  filteredCount: number
  languages: string[]
  warnings: string[]
  failedQueries: Array<{ query: string; message: string; status?: number }>
  limits: {
    perQuery: number
    maxTechnologies: number
    maxCandidates: number
    minBodyLength: number
    recentUpdateDays: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

function getNestedRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = source[key]
  return isRecord(value) ? value : null
}

function getPreferredTechnologies(developerProfileRow: Record<string, unknown>): string[] {
  const structured = getNestedRecord(developerProfileRow, 'developer_profile')
  const githubProfile = getNestedRecord(developerProfileRow, 'github_profile')

  return stringArray([
    ...stringArray(developerProfileRow.preferred_technologies),
    ...stringArray(developerProfileRow.preferred_tech_stack),
    ...stringArray(structured?.frameworks),
    ...(Array.isArray(structured?.languages)
      ? structured.languages.flatMap((item) =>
          isRecord(item) && typeof item.name === 'string' ? [item.name] : [],
        )
      : []),
    ...(Array.isArray(githubProfile?.languages)
      ? githubProfile.languages.flatMap((item) =>
          isRecord(item) && typeof item.name === 'string' ? [item.name] : [],
        )
      : []),
  ]).slice(0, MAX_TECHNOLOGIES)
}

function isGitHubSearchLanguage(technology: string): boolean {
  return /^[A-Za-z0-9+#.\-]+$/u.test(technology)
}

function quoteLabel(label: string): string {
  return `label:"${label}"`
}

function createSearchQueries(technologies: string[]): string[] {
  const labels = ['good first issue', 'help wanted']
  const usableTechnologies = technologies.filter(isGitHubSearchLanguage)
  const queries =
    usableTechnologies.length > 0
      ? usableTechnologies.flatMap((technology) =>
          labels.map(
            (label) =>
              `is:issue is:open ${quoteLabel(label)} language:${technology}`,
          ),
        )
      : labels.map((label) => `is:issue is:open ${quoteLabel(label)}`)

  return queries
}

function repositoryFromApiUrl(
  repositoryUrl: string,
): CandidateIssue['repository'] | null {
  const match = repositoryUrl.match(/\/repos\/([^/]+)\/([^/]+)$/u)
  if (!match) return null
  const [, owner, name] = match
  const fullName = `${owner}/${name}`
  return {
    owner,
    name,
    fullName,
    url: `https://github.com/${fullName}`,
  }
}

function inferredLanguageFromQuery(query: string): string | null {
  const match = query.match(/\blanguage:([^\s]+)/u)
  return match?.[1] ?? null
}

function toCandidateIssue(
  item: GitHubSearchIssueItemDto,
  query: string,
): CandidateIssue | null {
  const repository = repositoryFromApiUrl(item.repositoryUrl)
  if (!repository || !item.body) return null
  return {
    id: item.id,
    issueNumber: item.number,
    title: item.title,
    body: item.body,
    issueUrl: item.htmlUrl,
    repository,
    labels: item.labels.map((label) => label.name).filter(Boolean),
    language: inferredLanguageFromQuery(query),
    languageSource: inferredLanguageFromQuery(query) ? 'query' : 'unknown',
    state: item.state,
    comments: item.comments,
    assignee: item.assignee,
    assignees: item.assignees,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    user: item.user,
  }
}

function isRecentlyUpdated(updatedAt: string): boolean {
  const updated = Date.parse(updatedAt)
  if (!Number.isFinite(updated)) return false
  const cutoff = Date.now() - RECENT_UPDATE_DAYS * 24 * 60 * 60 * 1000
  return updated >= cutoff
}

function passesBasicFilters(item: GitHubSearchIssueItemDto): boolean {
  if (item.state !== 'open') return false
  if (item.pullRequest) return false
  if (item.assignee || item.assignees.length > 0) return false
  if (!item.body || item.body.trim().length < MIN_BODY_LENGTH) return false
  if (!isRecentlyUpdated(item.updatedAt)) return false
  return true
}

export async function handleGetCandidateIssues(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const session = await readSession(request, env)
  if (!session) throw new ApiError('未登录', 401)

  const currentUser = await readCurrentUser(env, session.githubId)
  if (!currentUser || currentUser.appUser.id !== session.userId) {
    throw new ApiError('登录状态已失效', 401)
  }

  const profileRow = currentUser.developerProfile as Record<string, unknown>
  const technologies = getPreferredTechnologies(profileRow)
  const queries = createSearchQueries(technologies)
  const github = createGitHubService(request, env)
  const warnings: string[] = []
  const failedQueries: CandidateIssuesMeta['failedQueries'] = []
  const rawItems: Array<{ item: GitHubSearchIssueItemDto; query: string }> = []

  if (technologies.length === 0) {
    warnings.push('用户没有 preferred technologies，已回退到通用 good first issue / help wanted 搜索。')
  }

  for (const query of queries) {
    if (rawItems.length >= TARGET_MAX_CANDIDATES) break
    try {
      const result = await github.searchIssues(query, {
        sort: 'updated',
        order: 'desc',
        perPage: PER_QUERY_LIMIT,
      })
      rawItems.push(...result.items.map((item) => ({ item, query })))
      if (result.incompleteResults) {
        warnings.push(`GitHub Search 返回 incomplete_results: ${query}`)
      }
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined
      const message =
        error instanceof Error ? error.message : 'GitHub 查询失败'
      failedQueries.push({ query, message, status })
      if (status === 429) warnings.push(`GitHub rate limit: ${query}`)
      else warnings.push(`单个查询失败，已跳过: ${query}`)
    }
  }

  const deduped = new Map<string, { item: GitHubSearchIssueItemDto; query: string }>()
  for (const entry of rawItems) {
    const key = String(entry.item.id || `${entry.item.repositoryUrl}#${entry.item.number}`)
    if (!deduped.has(key)) deduped.set(key, entry)
  }

  const issues = [...deduped.values()]
    .filter(({ item }) => passesBasicFilters(item))
    .map(({ item, query }) => toCandidateIssue(item, query))
    .filter((item): item is CandidateIssue => Boolean(item))
    .slice(0, TARGET_MAX_CANDIDATES)

  if (issues.length < TARGET_MIN_CANDIDATES) {
    warnings.push(
      `候选 Issue 数量少于 ${TARGET_MIN_CANDIDATES}，本阶段不放宽到普通 issue 搜索。`,
    )
  }

  console.info('[candidate-issues] fetched', {
    technologies,
    queryCount: queries.length,
    rawCount: rawItems.length,
    deduplicatedCount: deduped.size,
    filteredCount: issues.length,
    failedQueryCount: failedQueries.length,
  })

  return success({
    issues,
    meta: {
      queries,
      rawCount: rawItems.length,
      deduplicatedCount: deduped.size,
      filteredCount: issues.length,
      languages: technologies,
      warnings,
      failedQueries,
      limits: {
        perQuery: PER_QUERY_LIMIT,
        maxTechnologies: MAX_TECHNOLOGIES,
        maxCandidates: TARGET_MAX_CANDIDATES,
        minBodyLength: MIN_BODY_LENGTH,
        recentUpdateDays: RECENT_UPDATE_DAYS,
      },
    } satisfies CandidateIssuesMeta,
  })
}
