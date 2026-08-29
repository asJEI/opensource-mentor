import { ensureEnum, ensureStringArray, isRecord } from './json'
import type {
  IssueDto,
  IssueRecommendation,
  PrDraft,
  RepoAnalysis,
  Roadmap,
  RoadmapPhase,
  UserProfileContext,
} from './types'
import { GUIDE_PHASE_TITLES } from './prompts/roadmap'

export function validateRepoAnalysisResult(
  parsed: Record<string, unknown>,
): RepoAnalysis {
  const techStack = isRecord(parsed.techStack) ? parsed.techStack : {}
  const activity = isRecord(parsed.activity) ? parsed.activity : {}
  const beginnerFriendliness = isRecord(parsed.beginnerFriendliness)
    ? parsed.beginnerFriendliness
    : {}
  const contributionAreas = Array.isArray(parsed.contributionAreas)
    ? parsed.contributionAreas
    : []

  return {
    overview: String(parsed.overview || '暂无项目概述'),
    techStack: {
      primaryLanguage: String(techStack.primaryLanguage || '未知'),
      coreTechnologies: ensureStringArray(techStack.coreTechnologies),
      buildTools: ensureStringArray(techStack.buildTools),
      testFrameworks: ensureStringArray(techStack.testFrameworks),
      architecture: String(techStack.architecture || '未知'),
    },
    activity: {
      level: ensureEnum(
        activity.level,
        ['very-active', 'active', 'moderate', 'low', 'inactive'] as const,
        'moderate',
      ),
      commitFrequency: String(activity.commitFrequency || '未知'),
      maintainerResponsiveness: String(
        activity.maintainerResponsiveness || '未知',
      ),
      lastMajorUpdate: String(activity.lastMajorUpdate || '未知'),
    },
    beginnerFriendliness: {
      level: ensureEnum(
        beginnerFriendliness.level,
        [
          'very-friendly',
          'friendly',
          'moderate',
          'challenging',
          'hard',
        ] as const,
        'moderate',
      ),
      score: Number(beginnerFriendliness.score) || 5,
      friendlyFactors: ensureStringArray(beginnerFriendliness.friendlyFactors),
      challengingFactors: ensureStringArray(
        beginnerFriendliness.challengingFactors,
      ),
    },
    domains: ensureStringArray(parsed.domains),
    gettingStartedTips: ensureStringArray(parsed.gettingStartedTips),
    contributionAreas: contributionAreas
      .filter(isRecord)
      .map((area) => ({
        name: String(area.name || '未命名'),
        description: String(area.description || ''),
        difficulty: ensureEnum(
          area.difficulty,
          ['easy', 'medium', 'hard'] as const,
          'medium',
        ),
        whyGoodForBeginners: String(area.whyGoodForBeginners || ''),
      })),
    confidence: Number(parsed.confidence) || 0.7,
  }
}

export function validateRecommendationResult(
  parsed: Record<string, unknown>,
  issues: IssueDto[],
  userProfile: UserProfileContext,
): IssueRecommendation {
  const items = Array.isArray(parsed.items) ? parsed.items : []

  const scoredIssues = items
    .filter(isRecord)
    .map((item) => {
      const index = Number(item.index)
      const originalIssue = issues[index] || issues[0]
      const matchDetails = isRecord(item.matchDetails) ? item.matchDetails : {}
      const matchScore =
        Number(item.matchScore ?? item.recommendationScore) || 50
      const parsedReasons = ensureStringArray(
        item.matchReasons ?? item.recommendationReasons,
      )
      const matchReasons =
        userProfile.profileSetupStatus !== 'completed'
          ? ['这是一个适合开源新手的 Issue。']
          : parsedReasons.length > 0
            ? parsedReasons
            : ['该 Issue 与你当前填写的画像具有一定匹配度']

      return {
        ...originalIssue,
        difficulty: ensureEnum(
          item.difficulty,
          ['easy', 'medium', 'hard'] as const,
          'medium',
        ),
        matchScore,
        matchReasons,
        recommendationScore: matchScore,
        confidence: Number(item.confidence) || 0.6,
        recommendationReasons: matchReasons,
        matchDetails: {
          difficultyMatch: Number(matchDetails.difficultyMatch) || 50,
          skillMatch: Number(matchDetails.skillMatch) || 50,
          impactScore: Number(matchDetails.impactScore) || 50,
          activityScore: Number(matchDetails.activityScore) || 50,
          beginnerFriendlyScore:
            Number(matchDetails.beginnerFriendlyScore) || 50,
        },
      }
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)

  return {
    items: scoredIssues,
    total: scoredIssues.length,
    summary:
      userProfile.profileSetupStatus === 'completed'
        ? String(parsed.summary || '已结合你的画像筛选 Issue')
        : '用户未提供个性化画像，已按纯新手标准筛选 Issue。',
  }
}

export function validatePrDraftResult(
  parsed: Record<string, unknown>,
  issue: IssueDto,
): PrDraft {
  const validTypes = [
    'feat',
    'fix',
    'docs',
    'refactor',
    'test',
    'chore',
    'style',
    'perf',
  ] as const

  return {
    title: String(parsed.title || `fix: ${issue.title}`),
    description: String(parsed.description || '暂无描述'),
    type: ensureEnum(parsed.type, validTypes, 'fix'),
    relatedIssue: String(parsed.relatedIssue || `#${issue.number}`),
    changes: ensureStringArray(parsed.changes),
    testingTips: ensureStringArray(parsed.testingTips),
    notes: ensureStringArray(parsed.notes),
    confidence: Number(parsed.confidence) || 0.6,
    improvementSuggestions: ensureStringArray(parsed.improvementSuggestions),
  }
}

export function validateRoadmapPhaseResult(
  parsed: Record<string, unknown>,
  phaseNumber: number,
): RoadmapPhase {
  const title = GUIDE_PHASE_TITLES[phaseNumber - 1] || `第 ${phaseNumber} 章`

  let source = parsed
  if (isRecord(parsed.phase)) {
    source = parsed.phase
  } else if (Array.isArray(parsed.phases)) {
    const matched = parsed.phases.find(
      (item) =>
        isRecord(item) &&
        (Number(item.phase) === phaseNumber ||
          String(item.title || '').includes(title)),
    )
    if (isRecord(matched)) source = matched
    else if (isRecord(parsed.phases[0])) source = parsed.phases[0]
  }

  const actionStepsRaw = Array.isArray(source.actionSteps)
    ? source.actionSteps.filter(isRecord)
    : []
  const actionSteps = actionStepsRaw.map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `step-${phaseNumber}-${index + 1}`,
    title: String(item.title || `Step ${index + 1}`).trim(),
    description:
      typeof item.description === 'string' ? item.description.trim() : undefined,
    commands: ensureStringArray(item.commands),
    expectedResult:
      typeof item.expectedResult === 'string'
        ? item.expectedResult.trim()
        : undefined,
    checkboxLabel:
      typeof item.checkboxLabel === 'string' && item.checkboxLabel.trim()
        ? item.checkboxLabel.trim()
        : '我已经完成',
  }))

  const fileRefsRaw = Array.isArray(source.fileRefs) ? source.fileRefs : []
  const fileRefs = fileRefsRaw
    .filter(isRecord)
    .map((item) => ({
      path: String(item.path || '').trim(),
      reason: String(item.reason || item.description || '').trim() || '建议阅读',
    }))
    .filter((item) => item.path.length > 0)

  let reproduce: RoadmapPhase['reproduce'] = null
  if (isRecord(source.reproduce)) {
    const steps = ensureStringArray(source.reproduce.steps)
    if (steps.length > 0) {
      reproduce = {
        title:
          typeof source.reproduce.title === 'string'
            ? source.reproduce.title
            : undefined,
        steps,
        constructExample:
          typeof source.reproduce.constructExample === 'string'
            ? source.reproduce.constructExample
            : undefined,
        expectedBehavior:
          typeof source.reproduce.expectedBehavior === 'string'
            ? source.reproduce.expectedBehavior
            : undefined,
        actualBehavior:
          typeof source.reproduce.actualBehavior === 'string'
            ? source.reproduce.actualBehavior
            : undefined,
        checkboxLabel:
          typeof source.reproduce.checkboxLabel === 'string'
            ? source.reproduce.checkboxLabel
            : '我成功复现了问题',
      }
    }
  }

  const learningItems = ensureStringArray(
    source.learningItems ??
      source.items ??
      source.points ??
      source.steps ??
      source.content ??
      source.bulletPoints,
  )
  const derivedLearningItems =
    learningItems.length > 0
      ? learningItems
      : actionSteps.map((step) => step.title).filter(Boolean)

  const goal = String(
    source.goal || source.summary || source.overview || source.description || '',
  ).trim()
  const actionIntro =
    typeof source.actionIntro === 'string' ? source.actionIntro.trim() : ''

  const hasStructuredContent =
    actionSteps.length > 0 ||
    fileRefs.length > 0 ||
    (reproduce && reproduce.steps.length > 0)

  if ((!goal && !actionIntro) || (derivedLearningItems.length === 0 && !hasStructuredContent)) {
    throw new Error(
      `第 ${phaseNumber} 章内容不完整（缺少 goal/actionSteps）`,
    )
  }

  return {
    phase: phaseNumber,
    title,
    goal: goal || actionIntro || title,
    actionIntro: actionIntro || undefined,
    actionSteps,
    fileRefs,
    reproduce,
    learningItems: derivedLearningItems,
    recommendedIssues: ensureStringArray(source.recommendedIssues),
    estimatedDuration: String(source.estimatedDuration || '待确认'),
    difficulty: ensureEnum(
      source.difficulty,
      ['easy', 'medium', 'hard'] as const,
      'medium',
    ),
    completionCriteria: ensureStringArray(
      source.completionCriteria ?? source.checklist,
    ),
    resources: ensureStringArray(source.resources ?? source.references),
  }
}

export function validateRoadmapResult(
  parsed: Record<string, unknown>,
): Roadmap {
  const phases = Array.isArray(parsed.phases) ? parsed.phases : []
  const parsedPhases = phases.filter(isRecord)

  return {
    title: String(parsed.title || 'Issue 贡献指南'),
    description: String(
      parsed.description || '围绕当前 Issue 理解问题、准备环境、完成修改并提交 PR。',
    ),
    totalEstimatedTime: String(parsed.totalEstimatedTime || '待确认'),
    phases: GUIDE_PHASE_TITLES.map((title, idx) => {
      const phase =
        parsedPhases.find((item) => Number(item.phase) === idx + 1) ||
        parsedPhases.find((item) => String(item.title || '').includes(title)) ||
        {}
      try {
        return validateRoadmapPhaseResult(phase, idx + 1)
      } catch {
        return {
          phase: idx + 1,
          title,
          goal: '本章内容暂未生成，请稍后重试。',
          learningItems: [] as string[],
          recommendedIssues: [] as string[],
          estimatedDuration: '待确认',
          difficulty: 'medium' as const,
          completionCriteria: [] as string[],
          resources: [] as string[],
        }
      }
    }),
    tips: ensureStringArray(parsed.tips),
    confidence: Number(parsed.confidence) || 0.7,
  }
}

export function extractIssueNumbers(text: string): number[] {
  const matches = text.match(/#(\d+)/g)
  if (!matches) return []
  const numbers = matches
    .map((m) => Number.parseInt(m.slice(1), 10))
    .filter((n, i, arr) => arr.indexOf(n) === i)
  return numbers.slice(0, 5)
}

export function suggestNextSteps(reply: string): string[] {
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
