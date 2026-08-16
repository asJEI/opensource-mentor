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
    throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
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
        frontend: '优先阅读界面、组件和交互相关模块',
        backend: '优先阅读 API、服务和数据处理模块',
        documentation: '优先实践文档结构、示例和开发者指南改进',
        testing: '优先理解测试框架并补充单元测试',
        devops: '优先理解 CI、构建和部署流程',
        ai: '优先阅读模型调用、Prompt 和 AI 功能模块',
        other: '根据 Issue 标签选择最感兴趣的贡献方向',
      }[userProfile.interests[0]]
    : undefined
  const issueRefs = goodFirstIssues.slice(0, 3).map(
    (i) => `#${i.number} ${i.title.slice(0, 40)}`,
  )
  if (issueRefs.length === 0) {
    issueRefs.push('#xxx 寻找 good first issue 标签的任务')
  }

  const phases = [
    {
      phase: 1,
      title: '项目认知与环境准备',
      goal: '了解项目背景和定位，搭建本地开发环境',
      learningItems: [
        `阅读 ${repository.fullName} 的 README.md 和项目介绍`,
        '了解项目的核心功能和架构设计',
        '学习 Git 和 GitHub 基本操作（fork、clone、branch）',
        `搭建本地开发环境，确保能跑通 ${language} 项目`,
        '阅读 CONTRIBUTING.md 了解贡献规范',
      ],
      recommendedIssues: issueRefs.slice(0, 1),
      estimatedDuration: '2-3 天',
      difficulty: 'easy' as const,
      completionCriteria: [
        '能独立 fork 和 clone 项目',
        '本地能成功运行项目',
        '能说出项目的 3 个核心功能',
        '了解提交 PR 的基本流程',
      ],
      resources: [
        '项目 README.md',
        'CONTRIBUTING.md',
        'Git 入门教程',
        `${language} 基础入门`,
      ],
    },
    {
      phase: 2,
      title: '代码阅读与模块理解',
      goal: '熟悉项目代码结构，理解核心模块的作用',
      learningItems: [
        '浏览项目目录结构，了解各模块功能',
        '从入口文件开始追踪主要执行流程',
        '学习项目的代码风格和命名规范',
        '理解核心数据结构和 API 设计',
        '阅读关键模块的代码和注释',
      ],
      recommendedIssues: issueRefs.slice(0, 2),
      estimatedDuration: '3-5 天',
      difficulty: 'easy' as const,
      completionCriteria: [
        '能画出项目的模块关系图',
        '能解释核心功能的实现原理',
        '能独立定位某个功能的代码位置',
        '理解项目的测试框架',
      ],
      resources: [
        '项目架构文档',
        'API 文档',
        '开发者指南',
        '核心模块源码',
      ],
    },
    {
      phase: 3,
      title: '小试牛刀：文档与简单修复',
      goal: '从文档和简单 Bug 开始，完成第一次贡献',
      learningItems: [
        '学习如何写高质量的文档',
        '练习使用项目的测试框架',
        '掌握代码审查的基本礼仪',
        '学习如何写清晰的 PR 描述',
        '了解维护者的 Review 习惯',
      ],
      recommendedIssues: issueRefs,
      estimatedDuration: '5-7 天',
      difficulty: 'easy' as const,
      completionCriteria: [
        '提交第一个文档类 PR 并被合并',
        '能独立运行单元测试',
        '正确响应 Review 意见',
        '了解项目的 CI/CD 流程',
      ],
      resources: [
        '文档规范指南',
        '测试用例编写指南',
        'PR 模板',
        '代码审查最佳实践',
      ],
    },
    {
      phase: 4,
      title: '深入参与：Bug 修复',
      goal: '独立完成 Bug 修复，加深对代码的理解',
      learningItems: [
        '学习调试技巧和问题定位方法',
        '理解 Bug 报告的标准格式',
        '练习编写回归测试',
        '掌握 Git 进阶操作（rebase、cherry-pick）',
        '学习如何与维护者有效沟通',
      ],
      recommendedIssues: ['#xxx 选择标注为 bug 的简单 Issue'],
      estimatedDuration: '1-2 周',
      difficulty: 'medium' as const,
      completionCriteria: [
        '独立完成一个 Bug 修复 PR',
        '能写对应的单元测试',
        '理解项目的错误处理模式',
        '能在 Issue 中清晰描述问题和方案',
      ],
      resources: [
        '调试技巧教程',
        '测试覆盖率报告',
        'Bug 报告模板',
        'Git 进阶指南',
      ],
    },
    {
      phase: 5,
      title: '功能贡献：小功能开发',
      goal: '参与小功能开发，学习完整的贡献流程',
      learningItems: [
        '学习功能需求的分析方法',
        '理解项目的设计理念和取舍',
        '练习编写功能设计文档',
        '掌握代码优化和性能调优',
        '学习如何做 Code Review',
      ],
      recommendedIssues: ['#xxx 选择 enhancement 类的小功能'],
      estimatedDuration: '1-2 周',
      difficulty: 'medium' as const,
      completionCriteria: [
        '独立完成一个小功能的开发',
        '代码通过所有测试和 Lint',
        'PR 被维护者接受合并',
        '能给其他贡献者提供 Review 意见',
      ],
      resources: [
        '功能设计规范',
        '性能优化指南',
        'Code Review 指南',
        '项目路线图',
      ],
    },
    {
      phase: 6,
      title: '社区融入与持续贡献',
      goal: '成为活跃的社区成员，帮助更多新人',
      learningItems: [
        '学习如何帮助新贡献者',
        '参与社区讨论和决策',
        '了解项目的治理结构',
        '练习技术写作和分享',
        '建立个人开源品牌',
      ],
      recommendedIssues: ['#xxx 参与讨论类 Issue'],
      estimatedDuration: '持续进行',
      difficulty: 'hard' as const,
      completionCriteria: [
        '能独立 Review 新人的 PR',
        '积极参与社区讨论',
        '有 3 个以上被合并的 PR',
        '被社区认可为活跃贡献者',
      ],
      resources: [
        '社区行为准则',
        '维护者指南',
        '开源治理文档',
        '技术写作指南',
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
        ? [`补齐 ${language} 基础，并完成一个仓库内的小练习`]
        : []),
      ...(i === 0 && knowsRepositoryLanguage
        ? [`直接使用已有的 ${language} 经验理解项目代码规范`]
        : []),
      ...(i === 0 && interestFocus ? [interestFocus] : []),
    ],
  }))

  const audienceDescription = {
    beginner: '开源新手',
    some_experience: '写过一些代码的开发者',
    project_experience: '有完整项目经验的开发者',
  }[experienceLevel]
  const goalTip = hasPersonalProfile
    ? {
        first_contribution: '以合并第一个 PR 作为近期路线里程碑',
        find_beginner_friendly_issues: '每个实践阶段先检查 good first issue 和 help wanted 标签',
        improve_engineering: '优先选择包含测试、调试和 Code Review 的实践任务',
        learn_new_technology: `记录 ${language} 与现有技术栈的差异，并用真实 Issue 验证学习成果`,
      }[userProfile.goals[0]]
    : '先完成一个文档或测试类小贡献，再进入代码修改'

  return {
    title: `${repository.fullName} 贡献者成长路线图`,
    description: hasPersonalProfile
      ? `这是一份结合编程语言、兴趣和学习目标，为${audienceDescription}定制的 ${repository.fullName} 贡献路线。`
      : `用户未提供个性化画像，本路线按纯新手标准从理解项目开始。`,
    totalEstimatedTime:
      experienceLevel === 'beginner'
        ? '4-8 周'
        : experienceLevel === 'some_experience'
          ? '3-6 周'
          : '2-4 周',
    phases: adjustedPhases,
    tips: [
      goalTip,
      '不要急于求成，每个阶段都要动手实践',
      '遇到问题先搜索再提问，提问时提供足够的上下文',
      '积极参与社区讨论，不要害怕犯错',
      '定期回顾学习成果，调整学习计划',
      '保持耐心，开源贡献是长期的旅程',
    ],
    confidence: 0.7,
  }
}
