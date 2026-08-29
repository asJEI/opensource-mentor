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

/** 单章生成专用 system，避免被通用解释 prompt 冲淡 */
export const roadmapPhaseSystemPrompt = `你是 OpenSource Mentor 的贡献指南生成器。
只输出一个合法 JSON 对象，不要 Markdown，不要代码围栏，不要额外说明。
默认使用简体中文。
硬性规则：
1. 必须包含非空 goal、非空 actionIntro、至少 2 个 actionSteps。
2. actionSteps 必须是对象数组；每项除 title 外，还必须有 description，以及 expectedResult 或 commands 之一。
3. 禁止只给标题的空壳步骤（例如只有「阅读 README」却没有任何说明）。
4. 没有证据时不要编造文件路径/命令；可写“未在已读取文档中确认”，但仍要给出可执行检查思路。
5. 字段值保持短句，但必须可操作；优先保证结构完整，不要写成长文导致 JSON 被截断。`

const PHASE_INSTRUCTIONS: Record<number, string> = {
  1: `### 大致了解（阅读型）
必填 actionSteps 2-3 步，例如：
- Step 1 · 确认 Issue 目标
- Step 2 · 浏览 README 开头
- Step 3 · 弄清完成后的结果
commands 可为空数组。reproduce 必须为 null。fileRefs 可为空数组。`,
  2: `### 环境准备（可执行）
必填 actionSteps 恰好 3 步：
1. Step 1 · Clone Repository（commands 含 git clone 与 cd）
2. Step 2 · 安装依赖（真实包管理命令；未知则写检查 package.json/requirements 的思路）
3. Step 3 · 启动或检查项目
每步都要有 expectedResult、checkboxLabel。
reproduce 必须为 null。`,
  3: `### 理解项目
必填：
- fileRefs：2-3 个真实相对路径（来自上下文文件树）
- actionSteps：2-3 步，引导打开并阅读这些文件
reproduce 必须为 null。`,
  4: `### 复现问题
必填 reproduce（不可为 null）：
- steps：至少 2 条复现步骤
- expectedBehavior / actualBehavior
- checkboxLabel
另给 actionSteps 2 步（可含检查命令）。
fileRefs 可为空。`,
  5: `### 修正方案
actionSteps：2-3 步短句；fileRefs 最多 3 个。
reproduce 必须为 null。不要长篇论证。`,
  6: `### 实现与验证
actionSteps 恰好 3 步：改哪里、怎么改、怎么验证。
commands 优先用已确认测试命令。
reproduce 必须为 null。`,
  7: `### PR 提交
actionSteps 3 步：去代码审查、去 PR 生成器、按 CONTRIBUTING 检查。
reproduce 必须为 null。fileRefs 可为空。`,
}

function buildMinimalSchemaExample(phaseNumber: number, ownerRepo: string): string {
  const title = GUIDE_PHASE_TITLES[phaseNumber - 1]
  const repoName = ownerRepo.split('/')[1] || 'repo'
  const base = {
    phase: phaseNumber,
    title,
    goal: '本章导读（1 句）',
    actionIntro: '这一章要达成什么（1 句）',
    actionSteps: [
      {
        title: 'Step 1 · 示例步骤',
        description: '为什么做',
        commands: [] as string[],
        expectedResult: '完成后应看到什么',
        checkboxLabel: '我已经完成',
      },
      {
        title: 'Step 2 · 示例步骤',
        description: '为什么做',
        commands: [] as string[],
        expectedResult: '完成后应看到什么',
        checkboxLabel: '我已经完成',
      },
    ],
    fileRefs: [] as Array<{ path: string; reason: string }>,
    reproduce: null as null | Record<string, unknown>,
    learningItems: ['步骤摘要 1', '步骤摘要 2'],
    recommendedIssues: [] as string[],
    estimatedDuration: '待确认',
    difficulty: 'medium',
    completionCriteria: ['完成本章勾选'],
    resources: [] as string[],
  }

  if (phaseNumber === 2) {
    base.actionSteps = [
      {
        title: 'Step 1 · Clone Repository',
        description: '先拿到代码',
        commands: [
          `git clone https://github.com/${ownerRepo}.git`,
          `cd ${repoName}`,
        ],
        expectedResult: '本地出现项目目录与 README',
        checkboxLabel: '我已经完成',
      },
      {
        title: 'Step 2 · 安装依赖',
        description: '装好运行所需依赖',
        commands: ['# 按仓库文档执行安装命令'],
        expectedResult: '依赖安装成功、无报错',
        checkboxLabel: '我已经完成',
      },
      {
        title: 'Step 3 · 启动或检查项目',
        description: '确认项目能跑起来或至少完成基础检查',
        commands: ['# 按 README 启动/检查'],
        expectedResult: '服务启动或检查通过',
        checkboxLabel: '项目已经正常运行',
      },
    ]
  }

  if (phaseNumber === 3) {
    base.fileRefs = [
      { path: 'README.md', reason: '先了解项目入口与运行方式' },
      { path: 'package.json', reason: '确认脚本与依赖（路径以真实文件树为准）' },
    ]
  }

  if (phaseNumber === 4) {
    base.reproduce = {
      title: '复现问题',
      steps: ['按 Issue 描述准备输入', '运行相关检查/命令', '观察结果是否符合预期'],
      constructExample: '',
      expectedBehavior: '预期应发生什么',
      actualBehavior: '当前实际发生了什么',
      checkboxLabel: '我成功复现了问题',
    }
  }

  return JSON.stringify(base, null, 2)
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

  const readmeSnippet = readme ? readme.slice(0, 1600) : '（未读取到 README）'
  const repositoryContextText = repositoryContext
    ? JSON.stringify(repositoryContext).slice(0, 3200)
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
    ? JSON.stringify(issueContext).slice(0, 2400)
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

/** 仅生成单章，输出可执行行动块结构 */
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
  const ownerRepo = params.repoName
  const schemaExample = buildMinimalSchemaExample(phaseNumber, ownerRepo)

  return `请只生成贡献指南第 ${phaseNumber} 章「${title}」的 JSON。
目标仓库：${ownerRepo}

${shared}

## 本章写作要求
${instruction}

## 输出模板（字段名必须一致，按此结构填写真实内容）
${schemaExample}

## 绝对禁止
- 返回空对象、缺少 actionSteps、actionSteps 为字符串数组
- 步骤只有 title，没有 description / expectedResult / commands
- 使用空泛句子如「按步骤操作」「参考后续章节」充当 goal/actionIntro
- 第 4 章把 reproduce 设为 null，或把环境准备内容写进复现章
- 输出 JSON 以外的任何文字

请直接输出完整 JSON。`
}

/** 内容不完整时的二次修复提示 */
export function roadmapPhaseRepairPrompt(params: {
  phaseNumber: number
  previousOutput: string
}): string {
  const title = GUIDE_PHASE_TITLES[params.phaseNumber - 1] || `第 ${params.phaseNumber} 章`
  return `上一版第 ${params.phaseNumber} 章「${title}」JSON 不完整或步骤过于空泛。
请基于下面内容重写一个完整 JSON（只输出 JSON）：
- 必须有具体 goal、actionIntro（不要空泛套话）
- actionSteps 至少 2 个对象；每项必须含 title、description，以及 expectedResult 或 commands
- 第 4 章必须有 reproduce.steps（至少 2 条）
- 保持简体中文，字段尽量短但可执行

上一版输出：
${params.previousOutput.slice(0, 3500)}`
}

/** @deprecated 全量生成兼容 */
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
每章必须包含 goal、actionIntro、actionSteps（至少 2 项）。
第 4 章必须包含 reproduce。
全部中文。严格 JSON。无证据不编造。`
}
