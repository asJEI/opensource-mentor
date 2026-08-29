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
- actionIntro：用通俗语言说明仓库做什么、Issue 解决什么、完成后的结果
- actionSteps：2-3 步“阅读型”行动，例如确认 Issue 标题、浏览 README 开头
- 不要堆专业术语`,
  2: `### 环境准备
- actionIntro：先把项目跑起来
- actionSteps 必须是可执行步骤，例如：
  1. Clone Repository（含 git clone / cd 命令）
  2. 安装依赖（真实命令）
  3. 启动/检查项目（真实命令）
- 每步包含 commands、expectedResult、checkboxLabel（如“我已经完成”“项目已经正常运行”）
- 命令必须来自真实仓库上下文；没有就写“未在已读取文档中确认……”并仍给检查思路`,
  3: `### 理解项目
- actionIntro：先跑通，再读关键文件
- fileRefs：列出 2-4 个真实路径（必须来自 confirmedFiles / issueRelatedFiles / fileTree）
- 每个 fileRef 写清 reason（这个文件负责什么、和 Issue 有什么关系）
- actionSteps：引导用户打开并阅读这些文件`,
  4: `### 复现问题
- actionIntro：围绕当前 Issue 复现
- reproduce 必填：
  - steps：复现步骤列表
  - constructExample：如需构造的输入/路径示例
  - expectedBehavior：预期行为
  - actualBehavior：当前实际行为
  - checkboxLabel：如“我成功复现了 #编号”
- actionSteps 可补充运行检查命令`,
  5: `### 修正方案
- actionIntro：区分“仓库确认事实”和“AI 建议”，各 1 句即可
- actionSteps：只要 2-3 步，短句；指出可能涉及的文件（路径必须真实或明确未确认）
- fileRefs：最多 3 个相关真实文件
- 不要长篇论证，优先可执行下一步`,
  6: `### 实现与验证
- actionIntro：开始修改并验证（1-2 句）
- actionSteps：恰好 3 步——改哪里、怎么改、怎么验证；描述保持短句
- commands 优先用已确认测试/检查命令；没有就明确未知
- checkboxLabel：如“我已完成本地验证”`,
  7: `### PR 提交
- actionIntro：提交前检查
- actionSteps：
  1. 去代码审查
  2. 去 PR 生成器
  3. 按 CONTRIBUTING / PR Template 检查
- checkboxLabel：如“我已准备好提交 PR”`,
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

  const readmeSnippet = readme ? readme.slice(0, 2000) : '（未读取到 README）'
  const repositoryContextText = repositoryContext
    ? JSON.stringify(repositoryContext).slice(0, 3800)
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

  return `你是一位资深开源贡献导师。请只生成 Contribution Guide 的第 ${phaseNumber} 章「${title}」。
输出必须是“可执行行动块”，不是空泛 bullet 列表。

目标仓库：${ownerRepo}
内容使用中文。

${shared}

## 本章写作要求
${instruction}

## 必须返回严格 JSON（只含一章）
{
  "phase": ${phaseNumber},
  "title": "${title}",
  "goal": "本章导读，1-2 句",
  "actionIntro": "先告诉用户这一章要达成什么",
  "actionSteps": [
    {
      "title": "Step 1 · Clone Repository",
      "description": "简短说明为什么做这一步",
      "commands": ["git clone https://github.com/${ownerRepo}.git", "cd ${ownerRepo.split('/')[1] || 'repo'}"],
      "expectedResult": "完成后你应该看到哪些文件/现象",
      "checkboxLabel": "我已经完成"
    }
  ],
  "fileRefs": [
    {
      "path": "真实/相对/路径.py",
      "reason": "这个文件负责什么、和当前 Issue 的关系"
    }
  ],
  "reproduce": {
    "title": "复现 #编号",
    "steps": ["步骤 1", "步骤 2"],
    "constructExample": "需要构造的示例（可空字符串）",
    "expectedBehavior": "预期行为",
    "actualBehavior": "当前实际行为",
    "checkboxLabel": "我成功复现了 Issue"
  },
  "learningItems": ["把 actionSteps 摘要成 3-5 条，兼容旧前端"],
  "recommendedIssues": [],
  "estimatedDuration": "预计时间；不确定写待确认",
  "difficulty": "easy | medium | hard",
  "completionCriteria": ["2-4 条完成标准"],
  "resources": ["真实来源"]
}

## 结构约束
1. actionSteps 至少 2 项、至多 4 项；每项 title 用 “Step N · 标题” 格式。
2. commands 只能使用仓库上下文能证明的命令；否则写明未确认，仍给检查思路。
3. fileRefs.path 必须来自真实文件树；第 3 章强烈建议提供；其他章可按需，最多 3 个。
4. 第 4 章 reproduce 必填；其他章 reproduce 可为 null。
5. 不要编造不存在的文件/命令。
6. title 必须精确为「${title}」，phase 必须为 ${phaseNumber}。
7. 严格返回 JSON，不要有额外文字；字段值尽量短，避免冗长段落。`
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
每章尽量包含 actionIntro、actionSteps、fileRefs、reproduce（第4章）。
全部中文。严格 JSON。无证据不编造。`
}
