import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { aiService } from '../services/aiService'
import { githubService } from '../services/githubService'
import { success } from '../utils/response'

// ============================================================
// 参数校验 Schema
// ============================================================

const explainIssueSchema = z.object({
  repository: z.object({
    fullName: z.string(),
    description: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    stars: z.number().optional(),
  }),
  issue: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    labels: z
      .array(
        z.object({
          name: z.string(),
          color: z.string().optional(),
        }),
      )
      .optional(),
  }),
})

const analyzeRepoSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
})

const userProfileSchema = z.object({
  profileSetupStatus: z
    .enum(['not_started', 'completed', 'skipped'])
    .default('skipped'),
  programmingLanguages: z
    .array(
      z.enum([
        'javascript',
        'typescript',
        'python',
        'java',
        'go',
        'rust',
        'cpp',
        'other',
      ]),
    )
    .default([]),
  experienceLevel: z
    .enum(['beginner', 'some_experience', 'project_experience'])
    .default('beginner'),
  interests: z
    .array(
      z.enum([
        'frontend',
        'backend',
        'documentation',
        'testing',
        'devops',
        'ai',
        'other',
      ]),
    )
    .default([]),
  goals: z
    .array(
      z.enum([
        'first_contribution',
        'find_beginner_friendly_issues',
        'improve_engineering',
        'learn_new_technology',
      ]),
    )
    .default([]),
})

const recommendIssuesSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  userProfile: userProfileSchema.default({
    profileSetupStatus: 'skipped',
    programmingLanguages: [],
    experienceLevel: 'beginner',
    interests: [],
    goals: [],
  }),
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  labels: z.string().optional(),
  perPage: z.number().min(1).max(100).optional().default(20),
  page: z.number().min(1).optional().default(1),
})

const generatePrSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  issueNumber: z.number().min(1, 'issueNumber 不能为空'),
  prType: z.string().optional(),
  additionalContext: z.string().optional(),
})

const generateRoadmapSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  userProfile: userProfileSchema.optional(),
  // 兼容旧客户端；新请求统一使用 userProfile
  userLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
})

const chatSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  message: z.string().min(1, 'message 不能为空'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .default([]),
})

// ============================================================
// Controller 方法
// ============================================================

/** POST /api/ai/test-connection */
export const testAIConnection = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await aiService.testConnection()
    res.json(success(result))
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/ai/explain
 * 解释 Issue
 */
export const explainIssue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = explainIssueSchema.parse(req.body)

    const result = await aiService.explainIssue(
      {
        id: 0,
        name: body.repository.fullName.split('/')[1] || '',
        fullName: body.repository.fullName,
        owner: body.repository.fullName.split('/')[0] || '',
        ownerAvatar: '',
        description: body.repository.description || null,
        stars: body.repository.stars || 0,
        forks: 0,
        watchers: 0,
        openIssues: 0,
        language: body.repository.language || null,
        topics: [],
        license: null,
        homepage: null,
        defaultBranch: '',
        createdAt: '',
        updatedAt: '',
        size: 0,
        htmlUrl: '',
      },
      {
        id: 0,
        number: body.issue.number,
        title: body.issue.title,
        body: body.issue.body || null,
        state: 'open',
        author: '',
        authorAvatar: '',
        labels: (body.issue.labels || []).map((l, idx) => ({
          id: idx,
          name: l.name,
          color: l.color || '000000',
          description: null,
        })),
        comments: 0,
        createdAt: '',
        updatedAt: '',
        htmlUrl: '',
      },
    )

    res.json(success(result))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/analyze-repo
 * AI 分析仓库
 * 自动从 GitHub 获取仓库信息和 README，然后交给 AI 分析
 */
export const analyzeRepository = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { owner, repo } = analyzeRepoSchema.parse(req.body)

    // 1. 从 GitHub 获取仓库信息
    const repository = await githubService.getRepository(owner, repo)

    // 2. 获取 README（失败则用空字符串，不影响主流程）
    let readme = ''
    try {
      readme = await githubService.getReadme(owner, repo)
    } catch {
      readme = ''
    }

    // 3. 交给 AI 分析
    const analysis = await aiService.analyzeRepository(repository, readme)

    res.json(
      success({
        repository,
        analysis,
      }),
    )
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/recommend-issues
 * Issue 智能推荐打分
 * 自动从 GitHub 获取 Issue 列表，然后 AI 打分排序
 */
export const recommendIssues = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { owner, repo, userProfile, state, labels, perPage, page } =
      recommendIssuesSchema.parse(req.body)

    // 1. 获取仓库信息
    const repository = await githubService.getRepository(owner, repo)

    // 2. 获取 Issue 列表
    const { items: issues } = await githubService.getIssues(owner, repo, {
      state,
      labels,
      perPage,
      page,
    })

    // 3. AI 推荐打分
    const recommendation = await aiService.recommendIssues(
      repository,
      issues,
      userProfile,
    )

    res.json(success(recommendation))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/generate-pr
 * 生成 PR 草稿
 * 自动获取 Issue 详情，然后 AI 生成
 */
export const generatePrDraft = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { owner, repo, issueNumber, prType, additionalContext } =
      generatePrSchema.parse(req.body)

    // 1. 获取仓库信息
    const repository = await githubService.getRepository(owner, repo)

    // 2. 获取 Issue 详情
    const issue = await githubService.getIssue(owner, repo, issueNumber)

    // 3. AI 生成 PR 草稿
    const prDraft = await aiService.generatePrDraft(repository, issue, {
      prType,
      additionalContext,
    })

    res.json(success(prDraft))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/generate-roadmap
 * 生成个性化学习路线图
 */
export const generateRoadmap = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = generateRoadmapSchema.parse(req.body)
    const { owner, repo } = body
    const userProfile = body.userProfile ?? {
      profileSetupStatus: body.userLevel ? 'completed' as const : 'skipped' as const,
      programmingLanguages: [],
      experienceLevel:
        body.userLevel === 'advanced'
          ? 'project_experience' as const
          : body.userLevel === 'intermediate'
            ? 'some_experience' as const
            : 'beginner' as const,
      interests: [],
      goals: [],
    }

    // 1. 获取仓库信息
    const repository = await githubService.getRepository(owner, repo)

    // 2. 获取 README
    let readme = ''
    try {
      readme = await githubService.getReadme(owner, repo)
    } catch {
      readme = ''
    }

    // 3. 获取 good first issue（用于推荐）
    let goodFirstIssues: any[] = []
    try {
      const { items } = await githubService.getIssues(owner, repo, {
        state: 'open',
        labels: 'good first issue',
        perPage: 10,
        page: 1,
      })
      goodFirstIssues = items
    } catch {
      goodFirstIssues = []
    }

    // 4. AI 生成路线图
    const roadmap = await aiService.generateRoadmap({
      repository,
      readme,
      userProfile,
      goodFirstIssues,
    })

    res.json(success(roadmap))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/chat
 * AI 导师对话
 */
export const chat = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { owner, repo, messages, message } = chatSchema.parse(req.body)

    // 1. 获取仓库信息
    const repository = await githubService.getRepository(owner, repo)

    // 2. AI 对话
    const response = await aiService.chat({
      repository,
      messages,
      userMessage: message,
    })

    res.json(success(response))
  } catch (err) {
    next(err)
  }
}
