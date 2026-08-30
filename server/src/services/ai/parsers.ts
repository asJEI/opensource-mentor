import {
  IssueExplain,
  Issue,
  RepoAnalysis,
  IssueRecommendation,
  RecommendedIssue,
  PrDraft,
  Roadmap,
  UserProfileContext,
} from '../../types'

export function parseJsonSafely(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        // ignore
      }
    }
    return {}
  }
}

export function validateExplainResult(parsed: Record<string, unknown>): IssueExplain {
  const difficulty = String(parsed.difficulty || 'medium').toLowerCase()
  const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
    ? (difficulty as 'easy' | 'medium' | 'hard')
    : 'medium'

  return {
    summary: String(parsed.summary || '暂无总结'),
    difficulty: validDifficulty,
    knowledge: ensureStringArray(parsed.knowledge, [
      '了解项目基本架构',
      '熟悉 Git 基本操作',
    ]),
    steps: ensureStringArray(parsed.steps, [
      '阅读 Issue 描述，理解需求',
      '在本地复现问题',
      '查找相关代码',
      '实现修复',
      '提交 PR',
    ]),
    estimatedTime: String(parsed.estimatedTime || '2-4 小时'),
    tips: ensureStringArray(parsed.tips, [
      '先看 CONTRIBUTING.md 了解贡献规范',
      '写代码前先和维护者确认方案',
      '提交后耐心等待 Review',
    ]),
  }
}

export function validateRepoAnalysisResult(parsed: Record<string, unknown>): RepoAnalysis {
  const techStack = (parsed.techStack as Record<string, unknown>) || {}
  const activity = (parsed.activity as Record<string, unknown>) || {}
  const beginnerFriendliness = (parsed.beginnerFriendliness as Record<string, unknown>) || {}
  const contributionAreas = (parsed.contributionAreas as unknown[]) || []

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
        ['very-active', 'active', 'moderate', 'low', 'inactive'],
        'moderate',
      ),
      commitFrequency: String(activity.commitFrequency || '未知'),
      maintainerResponsiveness: String(activity.maintainerResponsiveness || '未知'),
      lastMajorUpdate: String(activity.lastMajorUpdate || '未知'),
    },
    beginnerFriendliness: {
      level: ensureEnum(
        beginnerFriendliness.level,
        ['very-friendly', 'friendly', 'moderate', 'challenging', 'hard'],
        'moderate',
      ),
      score: Number(beginnerFriendliness.score) || 5,
      friendlyFactors: ensureStringArray(beginnerFriendliness.friendlyFactors),
      challengingFactors: ensureStringArray(beginnerFriendliness.challengingFactors),
    },
    domains: ensureStringArray(parsed.domains),
    gettingStartedTips: ensureStringArray(parsed.gettingStartedTips),
    contributionAreas: contributionAreas
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((area) => ({
        name: String(area.name || '未命名'),
        description: String(area.description || ''),
        difficulty: ensureEnum(
          area.difficulty,
          ['easy', 'medium', 'hard'],
          'medium',
        ),
        whyGoodForBeginners: String(area.whyGoodForBeginners || ''),
      })),
    confidence: Number(parsed.confidence) || 0.7,
  }
}

export function validateRecommendationResult(
  parsed: Record<string, unknown>,
  issues: Issue[],
  userProfile: UserProfileContext,
): IssueRecommendation {
  const items = (parsed.items as unknown[]) || []

  const scoredIssues: RecommendedIssue[] = items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const index = Number(item.index)
      const originalIssue = issues[index] || issues[0]
      const matchDetails = (item.matchDetails as Record<string, unknown>) || {}
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
          ['easy', 'medium', 'hard'],
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
          beginnerFriendlyScore: Number(matchDetails.beginnerFriendlyScore) || 50,
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
  issue: Issue,
): PrDraft {
  const validTypes: PrDraft['type'][] = [
    'feat',
    'fix',
    'docs',
    'refactor',
    'test',
    'chore',
    'style',
    'perf',
  ]

  return {
    title: String(parsed.title || `fix: ${issue.title}`),
    description: String(parsed.description || '暂无描述'),
    type: ensureEnum(parsed.type, validTypes, 'fix'),
    relatedIssue: `Closes #${issue.number}`,
    changes: ensureStringArray(parsed.changes),
    testingTips: ensureStringArray(parsed.testingTips),
    notes: ensureStringArray(parsed.notes),
    confidence: Number(parsed.confidence) || 0.6,
    improvementSuggestions: ensureStringArray(parsed.improvementSuggestions),
  }
}

export function validateRoadmapResult(parsed: Record<string, unknown>): Roadmap {
  const phases = (parsed.phases as unknown[]) || []

  return {
    title: String(parsed.title || '开源贡献学习路线图'),
    description: String(parsed.description || '帮助你从零开始参与开源项目'),
    totalEstimatedTime: String(parsed.totalEstimatedTime || '2-4 周'),
    phases: phases
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map((phase, idx) => ({
        phase: Number(phase.phase) || idx + 1,
        title: String(phase.title || `第 ${idx + 1} 阶段`),
        goal: String(phase.goal || ''),
        learningItems: ensureStringArray(phase.learningItems),
        recommendedIssues: ensureStringArray(phase.recommendedIssues),
        estimatedDuration: String(phase.estimatedDuration || '1 周'),
        difficulty: ensureEnum(
          phase.difficulty,
          ['easy', 'medium', 'hard'],
          'medium',
        ),
        completionCriteria: ensureStringArray(phase.completionCriteria),
        resources: ensureStringArray(phase.resources),
      })),
    tips: ensureStringArray(parsed.tips),
    confidence: Number(parsed.confidence) || 0.7,
  }
}

export function ensureStringArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  return fallback
}

export function ensureEnum<T extends string>(
  value: unknown,
  validValues: T[],
  fallback: T,
): T {
  const str = String(value)
  return (validValues as string[]).includes(str) ? (str as T) : fallback
}
