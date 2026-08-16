import { ensureEnum, ensureStringArray, isRecord } from './json'
import type {
  IssueDto,
  IssueRecommendation,
  PrDraft,
  RepoAnalysis,
  Roadmap,
  UserProfileContext,
} from './types'

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

export function validateRoadmapResult(
  parsed: Record<string, unknown>,
): Roadmap {
  const phases = Array.isArray(parsed.phases) ? parsed.phases : []

  return {
    title: String(parsed.title || '开源贡献学习路线图'),
    description: String(
      parsed.description || '帮助你从零开始参与开源项目',
    ),
    totalEstimatedTime: String(parsed.totalEstimatedTime || '2-4 周'),
    phases: phases.filter(isRecord).map((phase, idx) => ({
      phase: Number(phase.phase) || idx + 1,
      title: String(phase.title || `第 ${idx + 1} 阶段`),
      goal: String(phase.goal || ''),
      learningItems: ensureStringArray(phase.learningItems),
      recommendedIssues: ensureStringArray(phase.recommendedIssues),
      estimatedDuration: String(phase.estimatedDuration || '1 周'),
      difficulty: ensureEnum(
        phase.difficulty,
        ['easy', 'medium', 'hard'] as const,
        'medium',
      ),
      completionCriteria: ensureStringArray(phase.completionCriteria),
      resources: ensureStringArray(phase.resources),
    })),
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
