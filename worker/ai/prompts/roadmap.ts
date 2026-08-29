import type { UserProfileContext } from '../types'

export const GUIDE_PHASE_TITLES = [
  '大致了解',
  '环境准备',
  '理解项目',
  '复现问题',
  '修正方案',
  '实现与验证',
  'PR 提交',
] as const

export type GuidePhaseTitle = (typeof GUIDE_PHASE_TITLES)[number]

const PHASE_INSTRUCTIONS: Record<number, string> = {
  1: `### 大致了解
- 用容易理解的语言介绍这个仓库是做什么的
- 解释当前 Issue 要解决什么问题
- 解释完成后的预期结果
- 避免一开始堆大量专业术语
- learningItems 顺序建议：仓库是什么 → Issue 问题 → 完成后的结果`,
  2: `### 环境准备
- 基于真实 README / CONTRIBUTING / 项目配置引导 clone 与本地运行
- 列出真实需要的语言、依赖、工具和版本（只写能确认的）
- 给出仓库真实存在的安装、启动、测试命令（优先 confirmedCommands / packageScripts）
- 不允许猜测不存在的命令；未确认时写“未在已读取文档中确认……”`,
  3: `### 理解项目
- 先引导用户完整跑通项目
- 解释整体架构和主要模块（只基于证据）
- 根据真实文件树找出与当前 Issue 最相关的核心文件
- 告诉用户应先阅读哪些文件，并解释各自职责
- 文件路径必须来自 fileTree / confirmedFiles / issueRelatedFiles`,
  4: `### 复现问题
- 根据 Issue 原始描述和仓库真实运行方式，一步一步引导复现
- learningItems 中必须明确区分“预期行为”和“实际行为”
- 如果无法可靠复现，明确说明缺少什么信息，不要猜测`,
  5: `### 修正方案
- 提出建议方案，并解释为什么这样改
- 指出可能涉及的模块（尽量引用真实路径）
- 必须区分“仓库确认事实”和“AI 建议”
- 不要把推测描述成确定方案`,
  6: `### 实现与验证
- 引导用户开始修改，并说明注意事项
- 帮助用户确认修改是否真正解决 Issue
- 验证步骤优先使用已确认的测试/运行命令；没有则明确写“未在仓库上下文中确认测试命令”
- learningItems 至少写满 3 条：改哪里、怎么改、怎么验证
- 即使证据不足，也要给出可执行的检查清单，不要返回空数组`,
  7: `### PR 提交
- 引导用户先进入现有“代码审查”功能检查修改
- 审查通过后再进入现有“PR 生成器”
- 结合真实 CONTRIBUTING / PR Template 说明项目要求；没有读到则写未确认
- 最终引导用户提交 GitHub PR
- recommendedIssues 保持空数组`,
}

function buildSharedContextBlock(params: {
  repoName: string
  repoDescription: string | null
  repoLanguage: string | null
  repoTopics: string[]
  stars: number
  userProfile: UserProfileContext
  readme: string
  repositoryContext?: Record<string, unknown>
  issueContext?: Record<string, unknown>
}): string {
  const {
    repoName,
    repoDescription,
    repoLanguage,
    repoTopics,
    stars,
    userProfile,
    readme,
    repositoryContext,
    issueContext,
  } = params

  const readmeSnippet = readme ? readme.slice(0, 2800) : '（未读取到 README）'
  const repositoryContextText = repositoryContext
    ? JSON.stringify(repositoryContext).slice(0, 5200)
    : '（未读取到额外仓库上下文）'

  const experienceDescription = {
    beginner: '第一次接触开源，需要更低理解成本和明确步骤',
    some_experience: '写过一些代码，可以进入项目运行、文件阅读和小范围修改',
    project_experience:
      '有完整项目经验，可以更快进入架构理解、复现、验证和 PR 规范',
  }[userProfile.experienceLevel]

  const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
  const profileText = hasPersonalProfile
    ? `- 开发经验: ${experienceDescription}
- 编程语言: ${userProfile.programmingLanguages.join(', ') || '未指定'}
- 兴趣方向: ${userProfile.interests.join(', ') || '未指定'}
- 学习目标: ${userProfile.goals.join(', ') || '未指定'}`
    : `- 用户未提供个性化画像，按纯新手处理
- 不得假设用户掌握特定语言`

  const selectedIssueText = issueContext
    ? JSON.stringify(issueContext).slice(0, 3200)
    : '（严重缺失：用户尚未选择具体 Issue）'

  return `## 仓库信息
- 仓库: ${repoName}
- 描述: ${repoDescription || '暂无'}
- 主要语言: ${repoLanguage || '未知'}
- Topics: ${repoTopics.length > 0 ? repoTopics.join(', ') : '无'}
- Stars: ${stars}

## 用户画像
${profileText}

## 当前 Issue 上下文
${selectedIssueText}

## README 摘要
${readmeSnippet}

## 真实仓库上下文
${repositoryContextText}`
}

/** 仅生成单章，缩短等待时间，便于前端渐进展示 */
export function roadmapPhasePrompt(params: {
  repoName: string
  repoDescription: string | null
  repoLanguage: string | null
  repoTopics: string[]
  stars: number
  userProfile: UserProfileContext
  readme: string
  repositoryContext?: Record<string, unknown>
  issueContext?: Record<string, unknown>
  phaseNumber: number
}): string {
  const phaseNumber = params.phaseNumber
  const title = GUIDE_PHASE_TITLES[phaseNumber - 1]
  if (!title) {
    throw new Error(`Invalid phase number: ${phaseNumber}`)
  }

  const shared = buildSharedContextBlock(params)
  const instruction = PHASE_INSTRUCTIONS[phaseNumber]

  return `你是一位资深开源贡献导师。请只生成 Contribution Guide 的第 ${phaseNumber} 章「${title}」，不要输出其他章节。

目标：围绕用户当前 Issue，帮助新手完成本章任务。内容使用中文。

${shared}

## 本章写作要求
${instruction}

## 必须返回严格 JSON（只含一章）
{
  "phase": ${phaseNumber},
  "title": "${title}",
  "goal": "本章导读，1-2 句",
  "learningItems": ["3-5 条正文要点"],
  "recommendedIssues": [],
  "estimatedDuration": "预计阅读/实践时间；不确定写待确认",
  "difficulty": "easy | medium | hard",
  "completionCriteria": ["2-4 条完成标准"],
  "resources": ["真实来源；路径必须来自仓库上下文"],
  "tips": ["可选：仅本章相关的 0-2 条提示"]
}

## 证据与防幻觉规则
1. 文件、目录、命令、类、函数、测试方式必须有仓库上下文证据。
2. 没有证据就写“未在仓库上下文中确认”或“建议检查……”，禁止编造。
3. title 必须精确为「${title}」，phase 必须为 ${phaseNumber}。
4. 严格返回 JSON，不要有额外文字。`
}

/** @deprecated 全量生成；保留兼容。新流程请用 roadmapPhasePrompt */
export function roadmapPrompt(params: {
  repoName: string
  repoDescription: string | null
  repoLanguage: string | null
  repoTopics: string[]
  stars: number
  userProfile: UserProfileContext
  readme: string
  goodFirstIssues: Array<{
    number: number
    title: string
    labels: string[]
  }>
  repositoryContext?: Record<string, unknown>
  issueContext?: Record<string, unknown>
}): string {
  const shared = buildSharedContextBlock(params)
  return `你是一位资深开源贡献导师。请生成完整的 7 章贡献指南 JSON。

${shared}

必须返回 phases 数组，title 依次为：${GUIDE_PHASE_TITLES.join('、')}。
全部中文。严格 JSON。无证据不编造。`
}
