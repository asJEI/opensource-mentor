import { t } from './locale'
import { config } from '../../config'
import type { Repository, RepoAnalysis } from '../../types'
import { repoAnalysisPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import { parseJsonSafely, validateRepoAnalysisResult } from './parsers'
import { callLLM } from './providers'
import type { AIRuntime } from './types'

export async function analyzeRepository(
  repository: Repository,
  readme: string,
  runtime: AIRuntime,
): Promise<RepoAnalysis> {
  if (!runtime.client) {
    return mockAnalyzeRepo(repository)
  }

  try {
    const prompt = repoAnalysisPrompt({
      repoName: repository.fullName,
      repoDescription: repository.description,
      repoLanguage: repository.language,
      stars: repository.stars,
      forks: repository.forks,
      openIssues: repository.openIssues,
      topics: repository.topics,
      license: repository.license,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
      readme,
    })

    const content = await callLLM(prompt, 0.7, runtime)
    const parsed = parseJsonSafely(content)
    return validateRepoAnalysisResult(parsed)
  } catch (err) {
    console.error('[AI] analyzeRepository failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockAnalyzeRepo(repository)
    }
    throw new AppError(t("AI 服务暂时不可用，请稍后重试"), 503)
  }
}

export function mockAnalyzeRepo(repository: Repository): RepoAnalysis {
  const language = repository.language || 'JavaScript'
  const isPopular = repository.stars > 10000
  const isActive =
    new Date().getTime() - new Date(repository.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 30

  return {
    overview: t("{0} 是一个{1}，主要使用 {2} 开发。该项目{3}，{4}。", [repository.fullName, repository.description || t("知名开源项目"), language, isPopular ? t("非常受欢迎，社区活跃") : t("有一定的用户基础"), isActive ? t("近期更新频繁") : t("更新节奏适中")]),
    techStack: {
      primaryLanguage: language,
      coreTechnologies: [language, 'Git', 'CI/CD'],
      buildTools: language === 'TypeScript' || language === 'JavaScript' ? ['npm', 'Vite'] : ['make', 'cmake'],
      testFrameworks: language === 'TypeScript' || language === 'JavaScript' ? ['Vitest', 'Jest'] : [t("单元测试框架")],
      architecture: isPopular ? t("成熟的模块化架构") : t("中等规模项目结构"),
    },
    activity: {
      level: isActive ? (isPopular ? 'very-active' : 'active') : 'moderate',
      commitFrequency: isActive ? t("每天都有提交") : t("每周有若干次提交"),
      maintainerResponsiveness: isPopular ? t("维护者团队响应较快") : t("维护者响应速度中等"),
      lastMajorUpdate: repository.updatedAt,
    },
    beginnerFriendliness: {
      level: isPopular ? 'friendly' : 'moderate',
      score: isPopular ? 7 : 5,
      friendlyFactors: [
        t("有详细的 README 文档"),
        t("有 CONTRIBUTING.md 贡献指南"),
        t("社区文档较完善"),
        t("有 good first issue 标签"),
      ],
      challengingFactors: [
        isPopular ? t("代码库较大，上手需要时间") : t("项目文档可能不够完善"),
        t("需要一定的领域知识"),
        t("代码审查标准较严格"),
      ],
    },
    domains: repository.topics.length > 0 ? repository.topics : [language, t("开源"), t("开发工具")],
    gettingStartedTips: [
      t("先阅读 README.md 和 CONTRIBUTING.md 了解项目"),
      t("从标有 good first issue 的 Issue 开始入手"),
      t("搭建本地开发环境，确保能跑通测试"),
      t("先从小的文档改进或 Bug 修复开始"),
      t("加入社区交流渠道，有问题及时提问"),
      t("阅读项目架构文档，理解模块划分"),
    ],
    contributionAreas: [
      {
        name: t("文档改进"),
        description: t("改进 README、文档、注释等，提升项目可读性"),
        difficulty: 'easy',
        whyGoodForBeginners: t("不需要深入理解代码，适合新人第一次贡献"),
      },
      {
        name: t("Bug 修复"),
        description: t("修复标记为 bug 的 Issue，提升项目稳定性"),
        difficulty: 'medium',
        whyGoodForBeginners: t("有明确的问题描述，适合练习调试能力"),
      },
      {
        name: t("测试用例补充"),
        description: t("为项目添加单元测试，提升测试覆盖率"),
        difficulty: 'medium',
        whyGoodForBeginners: t("可以通过写测试深入理解代码逻辑"),
      },
      {
        name: t("功能优化"),
        description: t("对现有功能进行性能或体验优化"),
        difficulty: 'hard',
        whyGoodForBeginners: t("需要较深的代码理解，适合进阶练习"),
      },
    ],
    confidence: 0.75,
  }
}
