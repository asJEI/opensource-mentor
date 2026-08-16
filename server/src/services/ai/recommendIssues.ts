import { config } from '../../config'
import type {
  Repository,
  Issue,
  IssueRecommendation,
  RecommendedIssue,
  UserProfileContext,
} from '../../types'
import { issueRecommendationPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import { parseJsonSafely, validateRecommendationResult } from './parsers'
import { callLLM } from './providers'
import type { AIRuntime } from './types'

export async function recommendIssues(
  repository: Repository,
  issues: Issue[],
  userProfile: UserProfileContext,
  runtime: AIRuntime,
): Promise<IssueRecommendation> {
  if (!runtime.client) {
    return mockRecommendIssues(repository, issues, userProfile)
  }

  try {
    const prompt = issueRecommendationPrompt({
      repoName: repository.fullName,
      repoLanguage: repository.language,
      repoDescription: repository.description,
      repoTopics: repository.topics,
      userProfile,
      issues: issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map((l) => l.name),
        comments: issue.comments,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        author: issue.author,
      })),
    })

    const content = await callLLM(prompt, 0.7, runtime)
    const parsed = parseJsonSafely(content)
    return validateRecommendationResult(parsed, issues, userProfile)
  } catch (err) {
    console.error('[AI] recommendIssues failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockRecommendIssues(repository, issues, userProfile)
    }
    throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
  }
}

export function mockRecommendIssues(
  repository: Repository,
  issues: Issue[],
  userProfile: UserProfileContext,
): IssueRecommendation {
  const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
  const repositoryLanguageAliases: Record<string, UserProfileContext['programmingLanguages'][number]> = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'java',
    go: 'go',
    rust: 'rust',
    c: 'cpp',
    'c++': 'cpp',
  }
  const repositoryLanguage = repository.language
    ? repositoryLanguageAliases[repository.language.toLowerCase()]
    : undefined
  const hasLanguageMatch =
    hasPersonalProfile &&
    repositoryLanguage !== undefined &&
    userProfile.programmingLanguages.includes(repositoryLanguage)
  const languageLabel = repository.language || '当前仓库语言'

  const scored = issues.map((issue, index) => {
    const issueText = [
      issue.title,
      issue.body || '',
      ...issue.labels.map((label) => label.name),
    ]
      .join(' ')
      .toLowerCase()
    const hasGoodFirstLabel = issue.labels.some((l) =>
      l.name.toLowerCase().includes('good first'),
    )
    const hasDocLabel = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
    const hasBugLabel = issue.labels.some((l) => l.name.toLowerCase().includes('bug'))
    const hasHelpLabel = issue.labels.some((l) =>
      l.name.toLowerCase().includes('help wanted'),
    )
    const hasComments = issue.comments > 0
    const isRecent =
      new Date().getTime() - new Date(issue.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 30
    const interestMatches: Array<{
      value: UserProfileContext['interests'][number]
      label: string
      keywords: string[]
    }> = [
      { value: 'frontend', label: '前端', keywords: ['frontend', 'react', 'vue', 'css', ' ui '] },
      { value: 'backend', label: '后端', keywords: ['backend', 'server', 'api', 'database'] },
      { value: 'documentation', label: '文档', keywords: ['documentation', 'docs', 'readme'] },
      { value: 'testing', label: '测试', keywords: ['test', 'testing', 'coverage'] },
      { value: 'devops', label: 'DevOps', keywords: ['devops', 'ci', 'docker', 'workflow'] },
      { value: 'ai', label: 'AI', keywords: [' ai ', 'llm', 'model', 'prompt'] },
    ]
    const matchedInterest = hasPersonalProfile
      ? interestMatches.find(
          (interest) =>
            userProfile.interests.includes(interest.value) &&
            interest.keywords.some((keyword) => issueText.includes(keyword)),
        )
      : undefined
    const difficulty: RecommendedIssue['difficulty'] =
      hasGoodFirstLabel || hasDocLabel
        ? 'easy'
        : /\b(architecture|refactor|performance|breaking)\b/.test(issueText)
          ? 'hard'
          : 'medium'
    const difficultyMatch = {
      beginner: { easy: 92, medium: 58, hard: 28 },
      some_experience: { easy: 78, medium: 88, hard: 55 },
      project_experience: { easy: 62, medium: 88, hard: 78 },
    }[userProfile.experienceLevel][difficulty]

    let score = 50
    if (hasGoodFirstLabel) score += 25
    if (hasDocLabel) score += 15
    if (hasHelpLabel) score += 10
    if (hasBugLabel) score += 5
    if (isRecent) score += 5
    if (hasComments) score += 5
    if (hasLanguageMatch) score += 8
    if (matchedInterest) score += 10
    score += Math.round((difficultyMatch - 60) / 5)
    if (
      hasPersonalProfile &&
      (userProfile.goals.includes('first_contribution') ||
        userProfile.goals.includes('find_beginner_friendly_issues')) &&
      difficulty === 'easy'
    ) {
      score += 6
    }
    if (
      hasPersonalProfile &&
      userProfile.goals.includes('improve_engineering') &&
      (hasBugLabel || issueText.includes('test'))
    ) {
      score += 5
    }
    if (
      hasPersonalProfile &&
      userProfile.goals.includes('learn_new_technology') &&
      repositoryLanguage !== undefined &&
      userProfile.programmingLanguages.length > 0 &&
      !userProfile.programmingLanguages.includes(repositoryLanguage)
    ) {
      score += 4
    }
    if (
      userProfile.experienceLevel === 'beginner' &&
      difficulty === 'hard'
    ) {
      score -= 20
    }
    score = Math.min(100, Math.max(0, score + (index % 5) * 2 - 4))

    const reasons: string[] = []
    if (!hasPersonalProfile) {
      reasons.push('这是一个适合开源新手的 Issue。')
    }
    if (hasLanguageMatch) {
      reasons.push(`该仓库主要使用 ${languageLabel}，与你填写的编程语言匹配`)
    }
    if (matchedInterest) {
      reasons.push(`属于你感兴趣的${matchedInterest.label}方向`)
    }
    if (
      hasPersonalProfile &&
      userProfile.goals.includes('first_contribution') &&
      difficulty === 'easy'
    ) {
      reasons.push('难度符合你完成第一次开源贡献的目标')
    }
    if (
      hasPersonalProfile &&
      userProfile.goals.includes('improve_engineering') &&
      (hasBugLabel || issueText.includes('test'))
    ) {
      reasons.push('包含调试或测试实践，有助于提升工程能力')
    }
    if (hasGoodFirstLabel) reasons.push('标有 good first issue 标签，官方推荐新人入手')
    if (hasDocLabel) reasons.push('文档类改动，门槛较低，适合新人')
    if (hasHelpLabel) reasons.push('维护者标记为需要帮助，欢迎贡献')
    if (isRecent) reasons.push('近期有更新，活跃度较高')
    if (hasComments) reasons.push('有讨论记录，可以参考其他人的思路')
    if (reasons.length === 0) reasons.push('难度适中，有学习价值')

    return {
      ...issue,
      difficulty,
      matchScore: score,
      matchReasons: reasons,
      recommendationScore: score,
      confidence: 0.65,
      recommendationReasons: reasons,
      matchDetails: {
        difficultyMatch,
        skillMatch: hasLanguageMatch
          ? 92
          : matchedInterest
            ? 82
          : hasPersonalProfile && userProfile.programmingLanguages.length > 0
            ? 48
            : 60,
        impactScore: hasBugLabel ? 75 : 60,
        activityScore: isRecent ? 80 : 55,
        beginnerFriendlyScore: hasGoodFirstLabel ? 90 : hasDocLabel ? 80 : 55,
      },
    }
  })

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore)

  return {
    items: scored,
    total: scored.length,
    summary: hasPersonalProfile
      ? `已结合你的编程语言、开发经验、兴趣和学习目标，从 ${issues.length} 个 Issue 中完成匹配。`
      : `用户未提供个性化画像，已从 ${issues.length} 个 Issue 中按纯新手标准筛选任务。`,
  }
}
