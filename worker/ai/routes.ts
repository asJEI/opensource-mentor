import type { PlatformEnv } from '../config'
import { createGitHubService } from '../github/factory'
import { ApiError, success } from '../http'
import { analyzeRepository } from './analyze'
import { chatWithMentor } from './chat'
import { explainIssue } from './explain'
import { generatePrDraft } from './generatePr'
import { isRecord } from './json'
import { recommendIssues } from './recommend'
import { resolveAIClient } from './resolveConfig'
import { generateRoadmap } from './roadmap'
import { testAIConnection } from './testConnection'
import type { ChatMessage, UserProfileContext } from './types'

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(`${field} 不能为空`, 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  return value.trim()
}

function requireOwnerRepo(body: Record<string, unknown>): {
  owner: string
  repo: string
} {
  return {
    owner: requireString(body.owner, 'owner'),
    repo: requireString(body.repo, 'repo'),
  }
}

const CONTRIBUTING_PATHS = [
  'CONTRIBUTING.md',
  '.github/CONTRIBUTING.md',
  'docs/CONTRIBUTING.md',
]

const PR_TEMPLATE_PATHS = [
  'PULL_REQUEST_TEMPLATE.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/pull_request_template.md',
]

const PROJECT_CONFIG_PATHS = [
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'pyproject.toml',
  'requirements.txt',
  'uv.lock',
  'Cargo.toml',
  'go.mod',
  'Makefile',
]

const RELEVANT_FILE_HINTS = [
  'src/',
  'app/',
  'lib/',
  'packages/',
  'tests/',
  'test/',
  '__tests__/',
  'docs/',
  'examples/',
  '.github/',
]

function truncateContext(value: string, max = 4000): string {
  return value.length > max ? `${value.slice(0, max)}\n…（已截断）` : value
}

function extractPackageMeta(projectConfigs: Array<{ path: string; content: string }>) {
  const packageJson = projectConfigs.find((item) =>
    /(^|\/)package\.json$/i.test(item.path),
  )
  if (!packageJson) {
    return {
      scripts: [] as Array<{ name: string; command: string }>,
      engines: null as Record<string, unknown> | null,
      packageManager: null as string | null,
    }
  }

  try {
    const parsed = JSON.parse(packageJson.content) as {
      scripts?: Record<string, unknown>
      engines?: Record<string, unknown>
      packageManager?: unknown
    }
    const scripts = Object.entries(parsed.scripts || {})
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .slice(0, 30)
      .map(([name, command]) => ({ name, command: String(command) }))

    return {
      scripts,
      engines: parsed.engines || null,
      packageManager:
        typeof parsed.packageManager === 'string' ? parsed.packageManager : null,
    }
  } catch {
    return {
      scripts: [] as Array<{ name: string; command: string }>,
      engines: null as Record<string, unknown> | null,
      packageManager: null as string | null,
    }
  }
}

function extractConfirmedCommands(params: {
  readme: string
  contributingDocs: Array<{ path: string; content: string }>
  packageScripts: Array<{ name: string; command: string }>
}) {
  const commandPattern =
    /(?:^|\n)\s*(?:\$\s*)?((?:npm|pnpm|yarn|bun|pip|uv|cargo|go|make|docker(?:-compose)?)\s+[^\n`]+)/gi
  const sources = [
    params.readme,
    ...params.contributingDocs.map((item) => item.content),
  ]
  const fromDocs: string[] = []
  for (const source of sources) {
    for (const match of source.matchAll(commandPattern)) {
      const command = match[1]?.trim()
      if (command && !fromDocs.includes(command)) fromDocs.push(command)
      if (fromDocs.length >= 20) break
    }
    if (fromDocs.length >= 20) break
  }

  return {
    fromDocs,
    fromPackageScripts: params.packageScripts.map(
      (item) => `${item.name}: ${item.command}`,
    ),
  }
}

function scoreIssueRelatedPaths(
  paths: Array<{ path: string; type: 'blob' | 'tree' }>,
  issueContext?: Record<string, unknown>,
) {
  const issue = isRecord(issueContext?.issue) ? issueContext.issue : null
  const text = [
    typeof issue?.title === 'string' ? issue.title : '',
    typeof issue?.body === 'string' ? issue.body : '',
    Array.isArray(issueContext?.confirmedContext)
      ? issueContext.confirmedContext.join(' ')
      : '',
    Array.isArray(issueContext?.possibleAreasToInspect)
      ? issueContext.possibleAreasToInspect.join(' ')
      : '',
  ]
    .join(' ')
    .toLowerCase()

  const tokens = Array.from(
    new Set(
      text
        .split(/[^a-z0-9_./-]+/i)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 3 && token.length <= 48),
    ),
  ).slice(0, 40)

  if (tokens.length === 0) return [] as string[]

  return paths
    .filter((item) => item.type === 'blob')
    .map((item) => {
      const pathLower = item.path.toLowerCase()
      const score = tokens.reduce(
        (sum, token) => (pathLower.includes(token) ? sum + 1 : sum),
        0,
      )
      return { path: item.path, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map((item) => item.path)
}

async function collectRoadmapRepositoryContext(
  github: ReturnType<typeof createGitHubService>,
  owner: string,
  repo: string,
  defaultBranch: string,
  readme: string,
  issueContext?: Record<string, unknown>,
) {
  const [contributingDocs, prTemplates, projectConfigs, fileTree] =
    await Promise.all([
      readExistingFiles(github, owner, repo, CONTRIBUTING_PATHS, 3000),
      readExistingFiles(github, owner, repo, PR_TEMPLATE_PATHS, 2500),
      readExistingFiles(github, owner, repo, PROJECT_CONFIG_PATHS, 2500),
      github.getRepositoryTree(owner, repo, defaultBranch).catch(() => []),
    ])

  const relevantPaths = fileTree
    .filter(
      (item) =>
        RELEVANT_FILE_HINTS.some((hint) => item.path.startsWith(hint)) ||
        /(^|\/)(readme|contributing|package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|makefile)$/i.test(
          item.path,
        ),
    )
    .slice(0, 120)

  const packageMeta = extractPackageMeta(projectConfigs)
  const confirmedCommands = extractConfirmedCommands({
    readme,
    contributingDocs,
    packageScripts: packageMeta.scripts,
  })
  const issueRelatedFiles = scoreIssueRelatedPaths(relevantPaths, issueContext)

  return {
    defaultBranch,
    contributingDocs,
    prTemplates,
    projectConfigs,
    packageScripts: packageMeta.scripts,
    packageEngines: packageMeta.engines,
    packageManager: packageMeta.packageManager,
    confirmedCommands,
    fileTree: relevantPaths,
    confirmedFiles: relevantPaths
      .filter((item) => item.type === 'blob')
      .map((item) => item.path),
    confirmedDirectories: relevantPaths
      .filter((item) => item.type === 'tree')
      .map((item) => item.path),
    issueRelatedFiles,
  }
}

async function readExistingFiles(
  github: ReturnType<typeof createGitHubService>,
  owner: string,
  repo: string,
  paths: string[],
  maxChars: number,
) {
  const results = await Promise.all(
    paths.map(async (path) => {
      const content = await github.getRawFile(owner, repo, path).catch(() => '')
      return content ? { path, content: truncateContext(content, maxChars) } : null
    }),
  )
  return results.filter(
    (item): item is { path: string; content: string } => item !== null,
  )
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError('请求体必须是合法 JSON', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
}

function parseExplainBody(body: unknown): {
  repository: {
    fullName: string
    description?: string | null
    language?: string | null
    stars?: number
  }
  issue: {
    number: number
    title: string
    body?: string | null
    labels?: Array<{ name: string; color?: string }>
  }
} {
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  if (!isRecord(body.repository) || !isRecord(body.issue)) {
    throw new ApiError('repository 与 issue 为必填字段', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const fullName = requireString(
    body.repository.fullName,
    'repository.fullName',
  )
  const title = requireString(body.issue.title, 'issue.title')
  const number = Number(body.issue.number)
  if (!Number.isInteger(number) || number < 1) {
    throw new ApiError('issue.number 必须是正整数', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const labelsRaw = body.issue.labels
  const labels = Array.isArray(labelsRaw)
    ? labelsRaw
        .filter(isRecord)
        .map((label) => ({
          name: String(label.name || ''),
          color: typeof label.color === 'string' ? label.color : undefined,
        }))
        .filter((label) => label.name)
    : undefined

  return {
    repository: {
      fullName,
      description:
        typeof body.repository.description === 'string'
          ? body.repository.description
          : body.repository.description === null
            ? null
            : undefined,
      language:
        typeof body.repository.language === 'string'
          ? body.repository.language
          : body.repository.language === null
            ? null
            : undefined,
      stars:
        typeof body.repository.stars === 'number'
          ? body.repository.stars
          : undefined,
    },
    issue: {
      number,
      title,
      body:
        typeof body.issue.body === 'string'
          ? body.issue.body
          : body.issue.body === null
            ? null
            : undefined,
      labels,
    },
  }
}

const LANGS = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'other',
] as const
const INTERESTS = [
  'frontend',
  'backend',
  'documentation',
  'testing',
  'devops',
  'ai',
  'other',
] as const
const GOALS = [
  'first_contribution',
  'find_beginner_friendly_issues',
  'improve_engineering',
  'learn_new_technology',
] as const

function filterEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is T =>
      typeof item === 'string' && (allowed as readonly string[]).includes(item),
  )
}

function parseUserProfile(
  raw: unknown,
  fallbackLevel?: 'beginner' | 'intermediate' | 'advanced',
): UserProfileContext {
  if (isRecord(raw)) {
    const status = raw.profileSetupStatus
    const profileSetupStatus =
      status === 'completed' || status === 'not_started' || status === 'skipped'
        ? status
        : 'skipped'
    const experienceLevel =
      raw.experienceLevel === 'some_experience' ||
      raw.experienceLevel === 'project_experience' ||
      raw.experienceLevel === 'beginner'
        ? raw.experienceLevel
        : 'beginner'

    return {
      profileSetupStatus,
      programmingLanguages: filterEnumArray(raw.programmingLanguages, LANGS),
      experienceLevel,
      interests: filterEnumArray(raw.interests, INTERESTS),
      goals: filterEnumArray(raw.goals, GOALS),
    }
  }

  return {
    profileSetupStatus: fallbackLevel ? 'completed' : 'skipped',
    programmingLanguages: [],
    experienceLevel:
      fallbackLevel === 'advanced'
        ? 'project_experience'
        : fallbackLevel === 'intermediate'
          ? 'some_experience'
          : 'beginner',
    interests: [],
    goals: [],
  }
}

/** POST /api/ai/explain */
export async function handleExplainIssue(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  const input = parseExplainBody(body)
  const { client } = await resolveAIClient(env, request, body)
  const result = await explainIssue(client, input)
  return success(result)
}

/** POST /api/ai/test-connection */
export async function handleTestAIConnection(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request).catch(() => ({}))
  const { client } = await resolveAIClient(env, request, body)
  const result = await testAIConnection(client)
  return success(result)
}

/** POST /api/ai/analyze-repo */
export async function handleAnalyzeRepo(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const { owner, repo } = requireOwnerRepo(body)
  const { client } = await resolveAIClient(env, request, body)
  const github = createGitHubService(request, env)

  const repository = await github.getRepository(owner, repo)
  let readme = ''
  try {
    readme = await github.getReadme(owner, repo)
  } catch {
    readme = ''
  }

  const analysis = await analyzeRepository(client, repository, readme)
  return success({ repository, analysis })
}

/** POST /api/ai/recommend-issues */
export async function handleRecommendIssues(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const { owner, repo } = requireOwnerRepo(body)
  const userProfile = parseUserProfile(body.userProfile)
  const state =
    body.state === 'closed' || body.state === 'all' || body.state === 'open'
      ? body.state
      : 'open'
  const labels =
    typeof body.labels === 'string' && body.labels.trim()
      ? body.labels.trim()
      : undefined
  const page = Number(body.page ?? 1)
  const perPage = Number(body.perPage ?? 20)
  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError('page 必须是 >= 1 的整数', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new ApiError('perPage 必须是 1-100 的整数', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }

  const { client } = await resolveAIClient(env, request, body)
  const github = createGitHubService(request, env)
  const repository = await github.getRepository(owner, repo)
  const { items: issues } = await github.getIssues(owner, repo, {
    state,
    labels,
    perPage,
    page,
  })
  const recommendation = await recommendIssues(
    client,
    repository,
    issues,
    userProfile,
  )
  return success(recommendation)
}

/** POST /api/ai/generate-roadmap */
export async function handleGenerateRoadmap(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const { owner, repo } = requireOwnerRepo(body)
  const userLevel =
    body.userLevel === 'beginner' ||
    body.userLevel === 'intermediate' ||
    body.userLevel === 'advanced'
      ? body.userLevel
      : undefined
  const userProfile = parseUserProfile(body.userProfile, userLevel)
  const { client } = await resolveAIClient(env, request, body)
  const github = createGitHubService(request, env)

  let issueContext = isRecord(body.issueContext) ? body.issueContext : undefined
  const issueNumber = Number(
    isRecord(issueContext?.issue) ? issueContext.issue.number : NaN,
  )
  const hasSelectedIssue = Number.isFinite(issueNumber) && issueNumber > 0

  const [repository, readme, liveIssue] = await Promise.all([
    github.getRepository(owner, repo),
    github.getReadme(owner, repo).catch(() => ''),
    hasSelectedIssue
      ? github.getIssue(owner, repo, issueNumber).catch(() => null)
      : Promise.resolve(null),
  ])

  if (liveIssue) {
    issueContext = {
      ...(issueContext || {}),
      issue: {
        ...(isRecord(issueContext?.issue) ? issueContext.issue : {}),
        number: liveIssue.number,
        title: liveIssue.title,
        body: liveIssue.body,
        labels: liveIssue.labels.map((label) => label.name),
        state: liveIssue.state,
        htmlUrl: liveIssue.htmlUrl,
      },
      liveIssueFetched: true,
    }
  }

  // 已选定目标 Issue 时不再额外拉 good first issue，节省请求时间
  const goodFirstIssues: Awaited<ReturnType<typeof github.getIssues>>['items'] =
    []

  const repositoryContext = await collectRoadmapRepositoryContext(
    github,
    owner,
    repo,
    repository.defaultBranch,
    readme,
    issueContext,
  )

  const roadmap = await generateRoadmap(client, {
    repository,
    readme,
    userProfile,
    goodFirstIssues,
    repositoryContext,
    issueContext,
  })
  return success(roadmap)
}

/** POST /api/ai/chat */
export async function handleChat(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const { owner, repo } = requireOwnerRepo(body)
  const message = requireString(body.message, 'message')
  const messagesRaw = Array.isArray(body.messages) ? body.messages : []
  const messages: ChatMessage[] = messagesRaw
    .filter(isRecord)
    .map((item): ChatMessage => {
      const role: ChatMessage['role'] =
        item.role === 'system' ||
        item.role === 'assistant' ||
        item.role === 'user'
          ? item.role
          : 'user'
      return {
        role,
        content: typeof item.content === 'string' ? item.content : '',
      }
    })
    .filter((item) => item.content)

  const { client } = await resolveAIClient(env, request, body)
  const github = createGitHubService(request, env)
  const repository = await github.getRepository(owner, repo)
  const response = await chatWithMentor(client, {
    repository,
    messages,
    userMessage: message,
  })
  return success(response)
}

/** POST /api/ai/generate-pr */
export async function handleGeneratePr(
  request: Request,
  env: PlatformEnv,
): Promise<Response> {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) {
    throw new ApiError('请求体必须是 JSON 对象', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const { owner, repo } = requireOwnerRepo(body)
  const issueNumber = Number(body.issueNumber)
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new ApiError('issueNumber 必须是正整数', 400, {
      errorCode: 'VALIDATION_ERROR',
    })
  }
  const prType =
    typeof body.prType === 'string' && body.prType.trim()
      ? body.prType.trim()
      : undefined
  const additionalContext =
    typeof body.additionalContext === 'string' && body.additionalContext.trim()
      ? body.additionalContext.trim()
      : undefined

  const { client } = await resolveAIClient(env, request, body)
  const github = createGitHubService(request, env)
  const repository = await github.getRepository(owner, repo)
  const issue = await github.getIssue(owner, repo, issueNumber)
  const prDraft = await generatePrDraft(client, repository, issue, {
    prType,
    additionalContext,
  })
  return success(prDraft)
}
