import { t } from './locale'
import { config } from '../../config'
import type { Repository, Issue, Roadmap, UserProfileContext } from '../../types'
import { roadmapPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import { parseJsonSafely, validateRoadmapResult } from './parsers'
import { callLLM } from './providers'
import type { AIRuntime } from './types'

export async function generateRoadmap(
  params: {
    repository: Repository
    readme: string
    userProfile: UserProfileContext
    goodFirstIssues: Issue[]
  },
  runtime: AIRuntime,
): Promise<Roadmap> {
  const { repository, readme, userProfile, goodFirstIssues } = params

  if (!runtime.client) {
    return mockGenerateRoadmap(repository, userProfile, goodFirstIssues)
  }

  try {
    const prompt = roadmapPrompt({
      repoName: repository.fullName,
      repoDescription: repository.description,
      repoLanguage: repository.language,
      repoTopics: repository.topics,
      stars: repository.stars,
      userProfile,
      readme,
      goodFirstIssues: goodFirstIssues.map((i) => ({
        number: i.number,
        title: i.title,
        labels: i.labels.map((l) => l.name),
      })),
    })

    const content = await callLLM(prompt, 0.8, runtime)
    const parsed = parseJsonSafely(content)
    return validateRoadmapResult(parsed)
  } catch (err) {
    console.error('[AI] generateRoadmap failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockGenerateRoadmap(repository, userProfile, goodFirstIssues)
    }
    throw new AppError(t("AI 服务暂时不可用，请稍后重试"), 503)
  }
}

export function mockGenerateRoadmap(
  repository: Repository,
  userProfile: UserProfileContext,
  goodFirstIssues: Issue[],
): Roadmap {
  const language = repository.language || 'JavaScript'
  const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
  const experienceLevel = hasPersonalProfile
    ? userProfile.experienceLevel
    : 'beginner'
  const languageAliases: Record<string, UserProfileContext['programmingLanguages'][number]> = {
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
    ? languageAliases[repository.language.toLowerCase()]
    : undefined
  const knowsRepositoryLanguage =
    hasPersonalProfile &&
    repositoryLanguage !== undefined &&
    userProfile.programmingLanguages.includes(repositoryLanguage)
  const needsLanguageFoundation =
    hasPersonalProfile &&
    userProfile.goals.includes('learn_new_technology') &&
    repositoryLanguage !== undefined &&
    !knowsRepositoryLanguage
  const interestFocus = hasPersonalProfile
    ? {
        frontend: t("优先阅读界面、组件和交互相关模块"),
        backend: t("优先阅读 API、服务和数据处理模块"),
        documentation: t("优先实践文档结构、示例和开发者指南改进"),
        testing: t("优先理解测试框架并补充单元测试"),
        devops: t("优先理解 CI、构建和部署流程"),
        ai: t("优先阅读模型调用、Prompt 和 AI 功能模块"),
        other: t("根据 Issue 标签选择最感兴趣的贡献方向"),
      }[userProfile.interests[0]]
    : undefined
  const issueRefs = goodFirstIssues.slice(0, 3).map(
    (i) => `#${i.number} ${i.title.slice(0, 40)}`,
  )
  if (issueRefs.length === 0) {
    issueRefs.push(t("#xxx 寻找 good first issue 标签的任务"))
  }

  const phases = [
    {
      phase: 1,
      title: t("项目认知与环境准备"),
      goal: t("了解项目背景和定位，搭建本地开发环境"),
      learningItems: [
        t("阅读 {0} 的 README.md 和项目介绍", [repository.fullName]),
        t("了解项目的核心功能和架构设计"),
        t("学习 Git 和 GitHub 基本操作（fork、clone、branch）"),
        t("搭建本地开发环境，确保能跑通 {0} 项目", [language]),
        t("阅读 CONTRIBUTING.md 了解贡献规范"),
      ],
      recommendedIssues: issueRefs.slice(0, 1),
      estimatedDuration: t("2-3 天"),
      difficulty: 'easy' as const,
      completionCriteria: [
        t("能独立 fork 和 clone 项目"),
        t("本地能成功运行项目"),
        t("能说出项目的 3 个核心功能"),
        t("了解提交 PR 的基本流程"),
      ],
      resources: [
        t("项目 README.md"),
        'CONTRIBUTING.md',
        t("Git 入门教程"),
        t("{0} 基础入门", [language]),
      ],
    },
    {
      phase: 2,
      title: t("代码阅读与模块理解"),
      goal: t("熟悉项目代码结构，理解核心模块的作用"),
      learningItems: [
        t("浏览项目目录结构，了解各模块功能"),
        t("从入口文件开始追踪主要执行流程"),
        t("学习项目的代码风格和命名规范"),
        t("理解核心数据结构和 API 设计"),
        t("阅读关键模块的代码和注释"),
      ],
      recommendedIssues: issueRefs.slice(0, 2),
      estimatedDuration: t("3-5 天"),
      difficulty: 'easy' as const,
      completionCriteria: [
        t("能画出项目的模块关系图"),
        t("能解释核心功能的实现原理"),
        t("能独立定位某个功能的代码位置"),
        t("理解项目的测试框架"),
      ],
      resources: [
        t("项目架构文档"),
        t("API 文档"),
        t("开发者指南"),
        t("核心模块源码"),
      ],
    },
    {
      phase: 3,
      title: t("小试牛刀：文档与简单修复"),
      goal: t("从文档和简单 Bug 开始，完成第一次贡献"),
      learningItems: [
        t("学习如何写高质量的文档"),
        t("练习使用项目的测试框架"),
        t("掌握代码审查的基本礼仪"),
        t("学习如何写清晰的 PR 描述"),
        t("了解维护者的 Review 习惯"),
      ],
      recommendedIssues: issueRefs,
      estimatedDuration: t("5-7 天"),
      difficulty: 'easy' as const,
      completionCriteria: [
        t("提交第一个文档类 PR 并被合并"),
        t("能独立运行单元测试"),
        t("正确响应 Review 意见"),
        t("了解项目的 CI/CD 流程"),
      ],
      resources: [
        t("文档规范指南"),
        t("测试用例编写指南"),
        t("PR 模板"),
        t("代码审查最佳实践"),
      ],
    },
    {
      phase: 4,
      title: t("深入参与：Bug 修复"),
      goal: t("独立完成 Bug 修复，加深对代码的理解"),
      learningItems: [
        t("学习调试技巧和问题定位方法"),
        t("理解 Bug 报告的标准格式"),
        t("练习编写回归测试"),
        t("掌握 Git 进阶操作（rebase、cherry-pick）"),
        t("学习如何与维护者有效沟通"),
      ],
      recommendedIssues: [t("#xxx 选择标注为 bug 的简单 Issue")],
      estimatedDuration: t("1-2 周"),
      difficulty: 'medium' as const,
      completionCriteria: [
        t("独立完成一个 Bug 修复 PR"),
        t("能写对应的单元测试"),
        t("理解项目的错误处理模式"),
        t("能在 Issue 中清晰描述问题和方案"),
      ],
      resources: [
        t("调试技巧教程"),
        t("测试覆盖率报告"),
        t("Bug 报告模板"),
        t("Git 进阶指南"),
      ],
    },
    {
      phase: 5,
      title: t("功能贡献：小功能开发"),
      goal: t("参与小功能开发，学习完整的贡献流程"),
      learningItems: [
        t("学习功能需求的分析方法"),
        t("理解项目的设计理念和取舍"),
        t("练习编写功能设计文档"),
        t("掌握代码优化和性能调优"),
        t("学习如何做 Code Review"),
      ],
      recommendedIssues: [t("#xxx 选择 enhancement 类的小功能")],
      estimatedDuration: t("1-2 周"),
      difficulty: 'medium' as const,
      completionCriteria: [
        t("独立完成一个小功能的开发"),
        t("代码通过所有测试和 Lint"),
        t("PR 被维护者接受合并"),
        t("能给其他贡献者提供 Review 意见"),
      ],
      resources: [
        t("功能设计规范"),
        t("性能优化指南"),
        t("Code Review 指南"),
        t("项目路线图"),
      ],
    },
    {
      phase: 6,
      title: t("社区融入与持续贡献"),
      goal: t("成为活跃的社区成员，帮助更多新人"),
      learningItems: [
        t("学习如何帮助新贡献者"),
        t("参与社区讨论和决策"),
        t("了解项目的治理结构"),
        t("练习技术写作和分享"),
        t("建立个人开源品牌"),
      ],
      recommendedIssues: [t("#xxx 参与讨论类 Issue")],
      estimatedDuration: t("持续进行"),
      difficulty: 'hard' as const,
      completionCriteria: [
        t("能独立 Review 新人的 PR"),
        t("积极参与社区讨论"),
        t("有 3 个以上被合并的 PR"),
        t("被社区认可为活跃贡献者"),
      ],
      resources: [
        t("社区行为准则"),
        t("维护者指南"),
        t("开源治理文档"),
        t("技术写作指南"),
      ],
    },
  ]

  // 根据统一用户画像调整起点
  let startIdx = 0
  if (experienceLevel === 'some_experience') startIdx = 1
  if (experienceLevel === 'project_experience') startIdx = 3

  const adjustedPhases = phases.slice(startIdx).map((p, i) => ({
    ...p,
    phase: i + 1,
    learningItems: [
      ...p.learningItems,
      ...(i === 0 && needsLanguageFoundation
        ? [t("补齐 {0} 基础，并完成一个仓库内的小练习", [language])]
        : []),
      ...(i === 0 && knowsRepositoryLanguage
        ? [t("直接使用已有的 {0} 经验理解项目代码规范", [language])]
        : []),
      ...(i === 0 && interestFocus ? [interestFocus] : []),
    ],
  }))

  const audienceDescription = {
    beginner: t("开源新手"),
    some_experience: t("写过一些代码的开发者"),
    project_experience: t("有完整项目经验的开发者"),
  }[experienceLevel]
  const goalTip = hasPersonalProfile
    ? {
        first_contribution: t("以合并第一个 PR 作为近期路线里程碑"),
        find_beginner_friendly_issues: t("每个实践阶段先检查 good first issue 和 help wanted 标签"),
        improve_engineering: t("优先选择包含测试、调试和 Code Review 的实践任务"),
        learn_new_technology: t("记录 {0} 与现有技术栈的差异，并用真实 Issue 验证学习成果", [language]),
      }[userProfile.goals[0]]
    : t("先完成一个文档或测试类小贡献，再进入代码修改")

  return {
    title: t("{0} 贡献者成长路线图", [repository.fullName]),
    description: hasPersonalProfile
      ? t("这是一份结合编程语言、兴趣和学习目标，为{0}定制的 {1} 贡献路线。", [audienceDescription, repository.fullName])
      : t("用户未提供个性化画像，本路线按纯新手标准从理解项目开始。"),
    totalEstimatedTime:
      experienceLevel === 'beginner'
        ? t("4-8 周")
        : experienceLevel === 'some_experience'
          ? t("3-6 周")
          : t("2-4 周"),
    phases: adjustedPhases,
    tips: [
      goalTip,
      t("不要急于求成，每个阶段都要动手实践"),
      t("遇到问题先搜索再提问，提问时提供足够的上下文"),
      t("积极参与社区讨论，不要害怕犯错"),
      t("定期回顾学习成果，调整学习计划"),
      t("保持耐心，开源贡献是长期的旅程"),
    ],
    confidence: 0.7,
  }
}
