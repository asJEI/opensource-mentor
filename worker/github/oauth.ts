import { redactSecrets } from '../../shared/byok'
import { parseJsonSafely } from '../ai/json'
import type { AIClient } from '../ai/client'
import { resolveAIClient } from '../ai/resolveConfig'
import { createSessionCookie } from '../auth/session'
import { persistOAuthUser } from '../auth/userPersistence'
import type { PlatformEnv } from '../config'

const GITHUB_WEB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_VERSION = '2022-11-28'
const OAUTH_STATE_COOKIE = 'osm_github_oauth_state'
const OAUTH_PROFILE_STORAGE_KEY = 'opensource-mentor:github-oauth-profile'

type GitHubUserResponse = {
  id: number
  login: string
  avatar_url: string
  html_url: string
  name: string | null
  bio: string | null
  company: string | null
  blog: string | null
  location: string | null
  public_repos: number
  followers: number
  following: number
  created_at: string
}

type GitHubRepoResponse = {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  html_url: string
  description: string | null
  language: string | null
  topics?: string[]
  stargazers_count: number
  forks_count: number
  fork: boolean
  archived: boolean
  pushed_at: string | null
  updated_at: string | null
}

type GitHubEventResponse = {
  type: string
  repo?: { name?: string }
  created_at: string
}

type GitHubSearchIssueItem = {
  html_url: string
  repository_url: string
  title: string
  state: string
  created_at: string
  updated_at: string
  pull_request?: unknown
}

type GitHubSearchResponse = {
  total_count: number
  items: GitHubSearchIssueItem[]
}

type OAuthTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

type DeveloperProfile = {
  authenticatedAt: string
  appUserId?: string
  profileSetupStatus?: 'not_started' | 'completed' | 'skipped'
  profileConfirmed?: boolean
  profile: {
    githubId: number
    username: string
    name: string
    avatar: string
    bio: string
    htmlUrl: string
    company: string
    blog: string
    location: string
    publicRepos: number
    followers: number
    following: number
    createdAt: string
  }
  repositories: Array<{
    name: string
    fullName: string
    owner: string
    htmlUrl: string
    description: string
    language: string
    topics: string[]
    stars: number
    forks: number
    isFork: boolean
    isArchived: boolean
    isOwnRepository: boolean
    pushedAt: string
    updatedAt: string
  }>
  recentRepositories: string[]
  languages: Array<{ name: string; score: number; repositories: number }>
  topics: Array<{ name: string; count: number }>
  projectTypes: Array<{ type: string; score: number }>
  contributions: {
    publicEventCount: number
    pullRequestsAuthored: number
    issuesAuthored: number
    contributedToOthers: boolean
    externalContributionCount: number
    recentEventTypes: Record<string, number>
    recentExternalRepositories: string[]
    recentPullRequests: Array<{
      title: string
      url: string
      repository: string
      state: string
      updatedAt: string
    }>
    recentIssues: Array<{
      title: string
      url: string
      repository: string
      state: string
      updatedAt: string
    }>
  }
  developerProfile?: StructuredDeveloperProfile
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced'

type StructuredDeveloperProfile = {
  level: SkillLevel
  confidence: number
  languages: Array<{
    name: string
    level: SkillLevel
    confidence: number
  }>
  frameworks: string[]
  domains: string[]
  open_source_experience: 'none' | 'beginner' | 'experienced'
  strengths: string[]
  possible_weaknesses: string[]
  evidence: string[]
  github_summary: string
}

function getOAuthClient(env: PlatformEnv) {
  return {
    clientId: env.GITHUB_OAUTH_CLIENT_ID?.trim() || '',
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || '',
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function createState(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

function getCookie(request: Request, name: string): string {
  const cookie = request.headers.get('Cookie') || ''
  const segments = cookie.split(';')
  for (const segment of segments) {
    const [rawKey, ...rawValue] = segment.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rawValue.join('='))
  }
  return ''
}

function serializeCookie(
  request: Request,
  name: string,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/api/auth/github; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

function redirect(location: string, init?: ResponseInit): Response {
  return new Response(null, {
    status: 302,
    ...init,
    headers: {
      Location: location,
      ...(init?.headers ?? {}),
    },
  })
}

function toCallbackUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.origin}/api/auth/github/callback`
}

function toAppUrl(request: Request, path = '/dashboard'): string {
  const url = new URL(request.url)
  return `${url.origin}${path}`
}

function githubApiHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'opensource-mentor',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
}

async function fetchGitHubJson<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubApiHeaders(accessToken),
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${path}`)
  }

  return (await response.json()) as T
}

function repoFromSearchItem(item: GitHubSearchIssueItem): string {
  const parts = item.repository_url.split('/repos/')
  return parts[1] || ''
}

function rankMap(map: Map<string, number>, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function inferContributionLevel(profile: DeveloperProfile): 'low' | 'medium' | 'high' {
  const repoScore = Math.min(profile.repositories.length, 30)
  const eventScore = Math.min(profile.contributions.publicEventCount, 40)
  const prScore = Math.min(profile.contributions.pullRequestsAuthored, 30)
  const externalBonus = profile.contributions.contributedToOthers ? 15 : 0
  const score = repoScore + eventScore + prScore + externalBonus
  if (score >= 70) return 'high'
  if (score >= 28) return 'medium'
  return 'low'
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}

function toSkillLevel(score: number): SkillLevel {
  if (score >= 68) return 'advanced'
  if (score >= 34) return 'intermediate'
  return 'beginner'
}

function detectFrameworks(profile: DeveloperProfile): string[] {
  const text = [
    ...profile.repositories.flatMap((repo) => [
      repo.name,
      repo.description,
      repo.language,
      ...repo.topics,
    ]),
  ]
    .join(' ')
    .toLowerCase()

  const rules: Array<[string, RegExp]> = [
    ['React', /\b(react|nextjs|next\.js|vite)\b/u],
    ['Vue', /\b(vue|nuxt)\b/u],
    ['Node.js', /\b(node|nodejs|express|fastify|npm)\b/u],
    ['Cloudflare Workers', /\b(cloudflare|workers|worker)\b/u],
    ['Docker', /\b(docker|compose|container)\b/u],
    ['PostgreSQL', /\b(postgres|postgresql|supabase)\b/u],
    ['AI / LLM', /\b(ai|llm|openai|rag|agent)\b/u],
    ['Testing', /\b(vitest|jest|playwright|testing-library)\b/u],
  ]

  return rules
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
    .slice(0, 8)
}

function normalizeDomain(type: string): string {
  if (type === 'developer-tooling') return 'backend'
  return type
}

function buildRuleBasedDeveloperProfile(
  profile: DeveloperProfile,
): StructuredDeveloperProfile {
  const ownRepos = profile.repositories.filter((repo) => repo.isOwnRepository)
  const nonForkRepos = ownRepos.filter((repo) => !repo.isFork)
  const sourceRepos = nonForkRepos.length > 0 ? nonForkRepos : ownRepos
  const nonTutorialRepos = sourceRepos.filter((repo) => {
    const text = `${repo.name} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase()
    return !/\b(tutorial|demo|example|learn|course|starter|template)\b/u.test(text)
  })
  const activeRepos = sourceRepos.filter((repo) => {
    const time = Date.parse(repo.pushedAt || repo.updatedAt)
    if (!Number.isFinite(time)) return false
    return Date.now() - time < 1000 * 60 * 60 * 24 * 365
  })
  const totalStars = profile.repositories.reduce((sum, repo) => sum + repo.stars, 0)
  const externalContrib = profile.contributions.externalContributionCount
  const prCount = profile.contributions.pullRequestsAuthored
  const issueCount = profile.contributions.issuesAuthored

  let score = 8
  score += Math.min(nonTutorialRepos.length * 5, 25)
  score += Math.min(activeRepos.length * 4, 20)
  score += Math.min(prCount * 2, 18)
  score += Math.min(issueCount, 10)
  score += Math.min(externalContrib * 5, 20)
  score += Math.min(Math.log10(totalStars + 1) * 6, 12)
  score -= Math.min(profile.repositories.filter((repo) => repo.isFork).length, 10)

  const level = toSkillLevel(score)
  const evidence = [
    `公开仓库 ${profile.repositories.length} 个，其中非 fork 自有仓库 ${nonForkRepos.length} 个`,
    `近一年活跃公开仓库 ${activeRepos.length} 个`,
    `公开 PR ${prCount} 个，公开 Issue ${issueCount} 个`,
    externalContrib > 0
      ? `发现 ${externalContrib} 个非本人仓库的公开贡献线索`
      : '暂未发现非本人仓库的公开贡献线索',
    `主要语言：${profile.languages.slice(0, 5).map((item) => item.name).join('、') || '暂无'}`,
  ]

  const languageTotal = profile.languages.reduce((sum, item) => sum + item.score, 0) || 1
  const languages = profile.languages.slice(0, 8).map((item) => {
    const ratio = item.score / languageTotal
    const languageScore =
      item.repositories >= 8 || ratio >= 0.45
        ? 56
        : item.repositories >= 3 || ratio >= 0.2
          ? 38
          : 18
    return {
      name: item.name,
      level: toSkillLevel(languageScore),
      confidence: clampConfidence(0.42 + Math.min(item.repositories, 10) * 0.04),
    }
  })

  const domains = [
    ...new Set(
      profile.projectTypes
        .map((item) => normalizeDomain(item.type))
        .filter((item) => ['frontend', 'backend', 'ai', 'devops', 'documentation', 'testing'].includes(item)),
    ),
  ].slice(0, 6)

  const openSourceExperience =
    externalContrib > 0 || prCount >= 5
      ? 'experienced'
      : prCount > 0 || issueCount > 0
        ? 'beginner'
        : 'none'

  return {
    level,
    confidence: clampConfidence(
      0.42 +
        Math.min(evidence.length, 5) * 0.04 +
        Math.min(activeRepos.length, 6) * 0.03 +
        (externalContrib > 0 ? 0.08 : 0),
    ),
    languages,
    frameworks: detectFrameworks(profile),
    domains,
    open_source_experience: openSourceExperience,
    strengths: [
      activeRepos.length > 0 ? '有近期维护或更新的公开项目' : '',
      languages.length > 1 ? '具备多语言/多技术栈接触痕迹' : '',
      externalContrib > 0 ? '存在第三方仓库贡献经验' : '',
    ].filter(Boolean),
    possible_weaknesses: [
      externalContrib === 0 ? '第三方开源协作证据较少' : '',
      prCount === 0 ? '公开 PR 经验证据不足' : '',
      profile.repositories.some((repo) => repo.isFork)
        ? '仓库数量受 fork 项目影响，不能直接等同于能力等级'
        : '',
    ].filter(Boolean),
    evidence,
    github_summary: `基于公开 GitHub 数据，当前更适合按 ${level} 水平保守匹配 Issue；仓库数量、star 或代码量仅作为辅助证据。`,
  }
}

function normalizeSkillLevel(value: unknown, fallback: SkillLevel): SkillLevel {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
    ? value
    : fallback
}

function normalizeProfileFromLLM(
  raw: Record<string, unknown>,
  fallback: StructuredDeveloperProfile,
): StructuredDeveloperProfile {
  const languages = Array.isArray(raw.languages)
    ? raw.languages
        .filter((item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
        )
        .map((item, index) => ({
          name:
            typeof item.name === 'string'
              ? item.name
              : fallback.languages[index]?.name || '',
          level: normalizeSkillLevel(item.level, fallback.languages[index]?.level || 'beginner'),
          confidence: clampConfidence(
            typeof item.confidence === 'number'
              ? item.confidence
              : fallback.languages[index]?.confidence || 0.5,
          ),
        }))
        .filter((item) => item.name)
    : fallback.languages

  const stringArray = (value: unknown, fallbackValue: string[]) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, 12)
      : fallbackValue

  return {
    level: normalizeSkillLevel(raw.level, fallback.level),
    confidence: clampConfidence(
      typeof raw.confidence === 'number' ? raw.confidence : fallback.confidence,
    ),
    languages,
    frameworks: stringArray(raw.frameworks, fallback.frameworks),
    domains: stringArray(raw.domains, fallback.domains),
    open_source_experience:
      raw.open_source_experience === 'none' ||
      raw.open_source_experience === 'beginner' ||
      raw.open_source_experience === 'experienced'
        ? raw.open_source_experience
        : fallback.open_source_experience,
    strengths: stringArray(raw.strengths, fallback.strengths),
    possible_weaknesses: stringArray(
      raw.possible_weaknesses,
      fallback.possible_weaknesses,
    ),
    evidence: stringArray(raw.evidence, fallback.evidence),
    github_summary:
      typeof raw.github_summary === 'string' && raw.github_summary.trim()
        ? raw.github_summary.trim()
        : fallback.github_summary,
  }
}

async function generateStructuredDeveloperProfile(
  profile: DeveloperProfile,
  aiClient?: AIClient,
): Promise<StructuredDeveloperProfile> {
  const ruleProfile = buildRuleBasedDeveloperProfile(profile)
  if (!aiClient) return ruleProfile

  const facts = {
    account: profile.profile,
    repositories: profile.repositories.slice(0, 30),
    languages: profile.languages,
    topics: profile.topics,
    projectTypes: profile.projectTypes,
    contributions: profile.contributions,
    ruleProfile,
  }

  const content = await aiClient.chatCompletions({
    responseFormat: { type: 'json_object' },
    temperature: 0.2,
    timeoutMs: 20_000,
    messages: [
      {
        role: 'system',
        content:
          'You generate conservative structured developer profiles from GitHub public facts. Return JSON only. Never inflate skill levels because of repository count, forks, tutorials, stars, or code volume alone. Every level must include confidence. Preserve evidence-based reasoning.',
      },
      {
        role: 'user',
        content: `基于以下 GitHub 事实和规则初判，输出这个 JSON Schema：{"level":"beginner|intermediate|advanced","confidence":0.0,"languages":[{"name":"TypeScript","level":"beginner|intermediate|advanced","confidence":0.0}],"frameworks":["React","Node.js"],"domains":["frontend","backend","ai","devops"],"open_source_experience":"none|beginner|experienced","strengths":[],"possible_weaknesses":[],"evidence":[],"github_summary":""}。\n\n要求：保守判断；不要因为 repo 数量多、fork 多、tutorial/demo 多、star 多或代码量大就判断 advanced；必须基于 PR、第三方贡献、近期活跃项目、技术栈复杂度等证据。\n\n事实：${JSON.stringify(facts)}`,
      },
    ],
  })

  return normalizeProfileFromLLM(parseJsonSafely(content), ruleProfile)
}

function inferProjectTypes(repos: GitHubRepoResponse[]) {
  const scores = new Map<string, number>()

  const add = (type: string, value = 1) =>
    scores.set(type, (scores.get(type) ?? 0) + value)

  for (const repo of repos) {
    const text = [
      repo.name,
      repo.description ?? '',
      repo.language ?? '',
      ...(repo.topics ?? []),
    ]
      .join(' ')
      .toLowerCase()

    if (/\b(react|vue|next|vite|css|ui|frontend|web)\b/u.test(text)) add('frontend')
    if (/\b(api|server|backend|express|fastify|worker|database|postgres)\b/u.test(text)) add('backend')
    if (/\b(ai|llm|agent|rag|ml|machine-learning|openai)\b/u.test(text)) add('ai')
    if (/\b(cli|tool|sdk|library|package|plugin)\b/u.test(text)) add('developer-tooling')
    if (/\b(docs|documentation|guide|tutorial)\b/u.test(text)) add('documentation')
    if (/\b(test|vitest|jest|playwright|e2e)\b/u.test(text)) add('testing')
    if (/\b(docker|k8s|devops|cloudflare|deploy|ci)\b/u.test(text)) add('devops')
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, score]) => ({ type, score }))
}

async function buildDeveloperProfile(
  accessToken: string,
): Promise<DeveloperProfile> {
  const user = await fetchGitHubJson<GitHubUserResponse>(accessToken, '/user')

  const [repos, events, prSearch, issueSearch] = await Promise.all([
    fetchGitHubJson<GitHubRepoResponse[]>(
      accessToken,
      '/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100',
    ),
    fetchGitHubJson<GitHubEventResponse[]>(
      accessToken,
      `/users/${encodeURIComponent(user.login)}/events/public?per_page=100`,
    ).catch(() => []),
    fetchGitHubJson<GitHubSearchResponse>(
      accessToken,
      `/search/issues?q=${encodeURIComponent(`author:${user.login} type:pr`)}&sort=updated&order=desc&per_page=20`,
    ).catch(() => ({ total_count: 0, items: [] })),
    fetchGitHubJson<GitHubSearchResponse>(
      accessToken,
      `/search/issues?q=${encodeURIComponent(`author:${user.login} type:issue`)}&sort=updated&order=desc&per_page=20`,
    ).catch(() => ({ total_count: 0, items: [] })),
  ])

  const languageScores = new Map<string, number>()
  const languageRepoCounts = new Map<string, number>()
  const topicCounts = new Map<string, number>()

  for (const repo of repos) {
    if (repo.language) {
      languageScores.set(repo.language, (languageScores.get(repo.language) ?? 0) + 1)
      languageRepoCounts.set(
        repo.language,
        (languageRepoCounts.get(repo.language) ?? 0) + 1,
      )
    }
    for (const topic of repo.topics ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    }
  }

  const eventTypes: Record<string, number> = {}
  const externalRepos = new Set<string>()
  for (const event of events) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1
    const repoName = event.repo?.name
    if (repoName && !repoName.toLowerCase().startsWith(`${user.login.toLowerCase()}/`)) {
      externalRepos.add(repoName)
    }
  }

  const recentPullRequests = prSearch.items.map((item) => ({
    title: item.title,
    url: item.html_url,
    repository: repoFromSearchItem(item),
    state: item.state,
    updatedAt: item.updated_at,
  }))
  const recentIssues = issueSearch.items.map((item) => ({
    title: item.title,
    url: item.html_url,
    repository: repoFromSearchItem(item),
    state: item.state,
    updatedAt: item.updated_at,
  }))
  for (const item of recentPullRequests) {
    if (
      item.repository &&
      !item.repository.toLowerCase().startsWith(`${user.login.toLowerCase()}/`)
    ) {
      externalRepos.add(item.repository)
    }
  }

  const profile: DeveloperProfile = {
    authenticatedAt: new Date().toISOString(),
    profile: {
      githubId: user.id,
      username: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url,
      bio: user.bio || '',
      htmlUrl: user.html_url,
      company: user.company || '',
      blog: user.blog || '',
      location: user.location || '',
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at,
    },
    repositories: repos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      htmlUrl: repo.html_url,
      description: repo.description || '',
      language: repo.language || '',
      topics: repo.topics ?? [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isFork: repo.fork,
      isArchived: repo.archived,
      isOwnRepository: repo.owner.login.toLowerCase() === user.login.toLowerCase(),
      pushedAt: repo.pushed_at || '',
      updatedAt: repo.updated_at || '',
    })),
    recentRepositories: repos.slice(0, 12).map((repo) => repo.full_name),
    languages: [...languageScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, score]) => ({
        name,
        score,
        repositories: languageRepoCounts.get(name) ?? 0,
      })),
    topics: rankMap(topicCounts, 16),
    projectTypes: inferProjectTypes(repos),
    contributions: {
      publicEventCount: events.length,
      pullRequestsAuthored: prSearch.total_count,
      issuesAuthored: issueSearch.total_count,
      contributedToOthers: externalRepos.size > 0,
      externalContributionCount: externalRepos.size,
      recentEventTypes: eventTypes,
      recentExternalRepositories: [...externalRepos].slice(0, 12),
      recentPullRequests,
      recentIssues,
    },
  }

  return {
    ...profile,
    profile: {
      ...profile.profile,
    },
  }
}

function renderOAuthSuccessPage(
  request: Request,
  profile: DeveloperProfile,
  sessionCookie: string,
): Response {
  const safePayload = JSON.stringify({
    ...profile,
    inferredContributionLevel: inferContributionLevel(profile),
  }).replace(/</gu, '\\u003c')
  const dashboardUrl = JSON.stringify(toAppUrl(request, '/dashboard?github_login=success'))
  const storageKey = JSON.stringify(OAUTH_PROFILE_STORAGE_KEY)

  return new Response(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub 登录成功 - OpenSource Mentor</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #020617; color: #e5e7eb; font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 420px; padding: 32px; text-align: center; }
      .mark { width: 48px; height: 48px; margin: 0 auto 18px; border-radius: 16px; display: grid; place-items: center; background: #2563eb; color: white; }
      p { color: #94a3b8; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">✓</div>
      <h1>GitHub 已连接</h1>
      <p>正在回到 OpenSource Mentor 工作台，并生成你的公开开发者画像。</p>
    </main>
    <script>
      localStorage.setItem(${storageKey}, ${JSON.stringify(safePayload)});
      window.location.replace(${dashboardUrl});
    </script>
  </body>
</html>`,
    {
      headers: (() => {
        const headers = new Headers({
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        })
        headers.append(
          'Set-Cookie',
          serializeCookie(request, OAUTH_STATE_COOKIE, '', 0),
        )
        headers.append('Set-Cookie', sessionCookie)
        return headers
      })(),
    },
  )
}

function redirectWithError(request: Request, reason: string): Response {
  const url = new URL(toAppUrl(request, '/?github_login=error'))
  url.searchParams.set('reason', reason)
  return redirect(url.toString(), {
    headers: {
      'Set-Cookie': serializeCookie(request, OAUTH_STATE_COOKIE, '', 0),
    },
  })
}

export function handleGitHubOAuthStart(
  request: Request,
  env: PlatformEnv,
): Response {
  const { clientId } = getOAuthClient(env)

  if (!clientId) {
    return redirectWithError(request, 'github_oauth_not_configured')
  }

  const state = createState()
  const authorizeUrl = new URL(GITHUB_WEB_AUTHORIZE_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', toCallbackUrl(request))
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('allow_signup', 'true')

  return redirect(authorizeUrl.toString(), {
    headers: {
      'Set-Cookie': serializeCookie(request, OAUTH_STATE_COOKIE, state, 600),
      'Cache-Control': 'no-store',
    },
  })
}

export async function handleGitHubOAuthCallback(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const { clientId, clientSecret } = getOAuthClient(env)
  if (!clientId || !clientSecret) {
    return redirectWithError(request, 'github_oauth_not_configured')
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  const expectedState = getCookie(request, OAUTH_STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(request, 'invalid_oauth_state')
  }

  try {
    const tokenResponse = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'opensource-mentor',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: toCallbackUrl(request),
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (!tokenResponse.ok) {
      return redirectWithError(request, 'token_exchange_failed')
    }

    const tokenJson = (await tokenResponse.json()) as OAuthTokenResponse
    if (!tokenJson.access_token || tokenJson.error) {
      console.warn(
        '[github-oauth] token exchange failed:',
        redactSecrets(tokenJson.error_description || tokenJson.error || 'unknown error'),
      )
      return redirectWithError(request, tokenJson.error || 'token_exchange_failed')
    }

    const profile = await buildDeveloperProfile(tokenJson.access_token)
    try {
      const { client } = await resolveAIClient(env, request, {})
      profile.developerProfile = await generateStructuredDeveloperProfile(
        profile,
        client,
      )
    } catch {
      profile.developerProfile = await generateStructuredDeveloperProfile(profile)
    }
    let persisted: Awaited<ReturnType<typeof persistOAuthUser>>
    try {
      persisted = await persistOAuthUser(
        env,
        {
          id: profile.profile.githubId,
          login: profile.profile.username,
          avatar_url: profile.profile.avatar,
        },
        profile,
        profile.developerProfile,
      )
    } catch (error) {
      console.error(
        '[github-oauth] supabase persistence failed:',
        redactSecrets(error instanceof Error ? error.message : 'unknown error'),
      )
      return redirectWithError(request, 'supabase_persistence_failed')
    }
    profile.appUserId = persisted.appUser.id
    profile.profileSetupStatus =
      persisted.developerProfile.profile_setup_status
    profile.profileConfirmed = persisted.developerProfile.profile_confirmed

    const sessionCookie = await createSessionCookie(request, env, {
      userId: persisted.appUser.id,
      githubId: profile.profile.githubId,
    })
    return renderOAuthSuccessPage(request, profile, sessionCookie)
  } catch (error) {
    console.error(
      '[github-oauth] callback failed:',
      redactSecrets(error instanceof Error ? error.message : 'unknown error'),
    )
    return redirectWithError(request, 'profile_fetch_failed')
  }
}
