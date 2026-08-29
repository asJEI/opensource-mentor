import type { UserProfileContext } from '../types'

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
  const {
    repoName,
    repoDescription,
    repoLanguage,
    repoTopics,
    stars,
    userProfile,
    readme,
    goodFirstIssues,
    repositoryContext,
    issueContext,
  } = params

  const readmeSnippet = readme ? readme.slice(0, 5000) : '（未读取到 README）'
  const repositoryContextText = repositoryContext
    ? JSON.stringify(repositoryContext).slice(0, 10000)
    : '（未读取到额外仓库上下文）'
  const issuesText =
    goodFirstIssues.length > 0
      ? goodFirstIssues
          .map((i) => `  - #${i.number} ${i.title} [${i.labels.join(', ')}]`)
          .join('\n')
      : '  暂无 good first issue'

  const experienceDescription = {
    beginner: '第一次接触开源，需要更低理解成本和明确步骤',
    some_experience: '写过一些代码，可以进入项目运行、文件阅读和小范围修改',
    project_experience:
      '有完整项目经验，可以更快进入架构理解、复现、验证和 PR 规范',
  }[userProfile.experienceLevel]

  const interestLabels: Record<
    UserProfileContext['interests'][number],
    string
  > = {
    frontend: '前端',
    backend: '后端',
    documentation: '文档',
    testing: '测试',
    devops: 'DevOps',
    ai: 'AI',
    other: '其他',
  }
  const goalLabels: Record<UserProfileContext['goals'][number], string> = {
    first_contribution: '完成第一次开源贡献',
    find_beginner_friendly_issues: '寻找适合新人的 Issue',
    improve_engineering: '提升工程能力',
    learn_new_technology: '学习新技术',
  }
  const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
  const profileText = hasPersonalProfile
    ? `- 开发经验: ${experienceDescription}
- 编程语言: ${userProfile.programmingLanguages.join(', ') || '未指定'}
- 兴趣方向: ${userProfile.interests.map((item) => interestLabels[item]).join(', ') || '未指定'}
- 学习目标: ${userProfile.goals.map((item) => goalLabels[item]).join(', ') || '未指定'}`
    : `- 用户未提供个性化画像，使用纯新手默认画像
- 经验按“第一次接触开源”处理
- 不得假设用户掌握特定语言或对特定方向感兴趣`

  const selectedIssueText = issueContext
    ? JSON.stringify(issueContext).slice(0, 6000)
    : '（严重缺失：用户尚未选择具体 Issue。此时不要假装已有目标 Issue，只能说明需要先选择 Issue。）'

  return `你是一位资深开源贡献导师。请生成“Contribution Guide”阅读文档，不是课程时间线，也不是通用学习路线。

本指南必须围绕用户当前选择的 Issue 动态生成：目标是帮助新手理解问题、准备环境、跑通项目、复现问题、提出修正方案、实现验证并提交 PR。

## 仓库信息
- 仓库: ${repoName}
- 描述: ${repoDescription || '暂无'}
- 主要语言: ${repoLanguage || '未知'}
- Topics: ${repoTopics.length > 0 ? repoTopics.join(', ') : '无'}
- Stars: ${stars}

## 用户画像
${profileText}

## 当前已选择 Issue 与前序分析上下文
${selectedIssueText}

## README 真实内容摘要
${readmeSnippet}

## 额外真实仓库上下文
以下内容来自 GitHub API 读取到的真实文件树、CONTRIBUTING、PR Template、项目配置和可执行脚本摘要：
${repositoryContextText}

## 可参考的新人 Issue（仅作背景，不要偏离当前目标 Issue）
${issuesText}

## 必须返回严格 JSON
{
  "title": "Contribution Guide: #Issue编号 Issue标题",
  "description": "用 1-2 句话说明这份指南如何帮助用户完成当前 Issue",
  "totalEstimatedTime": "根据 Issue 与上下文保守估计；不确定则写 '待确认'",
  "phases": [
    {
      "phase": 1,
      "title": "大致了解",
      "goal": "本章导读：仓库做什么、Issue 解决什么、完成后的预期结果",
      "learningItems": ["4-6 条正文要点"],
      "recommendedIssues": [],
      "estimatedDuration": "预计阅读/实践时间",
      "difficulty": "easy | medium | hard",
      "completionCriteria": ["3-4 条本章完成标准"],
      "resources": ["真实来源；路径必须来自仓库上下文"]
    }
  ],
  "tips": ["全局建议，4-6 条"],
  "confidence": 0-1
}

## 固定章节（必须且只返回 7 个 phases，title 必须完全一致）
1. 大致了解
2. 环境准备
3. 理解项目
4. 复现问题
5. 修正方案
6. 实现与验证
7. PR 提交

## 各章写作要求

### 1. 大致了解
- 用容易理解的语言介绍这个仓库是做什么的
- 解释当前 Issue 要解决什么问题
- 解释完成后的预期结果
- 避免一开始堆大量专业术语
- learningItems 顺序建议覆盖：仓库是什么 → Issue 问题 → 完成后的结果

### 2. 环境准备
- 基于真实 README / CONTRIBUTING / 项目配置引导 clone 与本地运行
- 列出真实需要的语言、依赖、工具和版本（只写能确认的）
- 给出仓库真实存在的安装、启动、测试命令（优先使用 confirmedCommands / packageScripts）
- 不允许猜测不存在的命令；未确认时写“未在已读取文档中确认……”

### 3. 理解项目
- 先引导用户完整跑通项目
- 解释整体架构和主要模块（只基于证据）
- 根据真实文件树找出与当前 Issue 最相关的核心文件
- 告诉用户应先阅读哪些文件，并解释各自职责
- 文件路径必须来自 fileTree / confirmedFiles / issueRelatedFiles；无法确认时只给方向，不给假路径

### 4. 复现问题
- 根据 Issue 原始描述和仓库真实运行方式，一步一步引导复现
- learningItems 中必须明确区分 Expected Behavior 和 Actual Behavior
- 如果无法可靠复现，明确说明缺少什么信息，不要猜测

### 5. 修正方案
- 提出 Suggested Approach，并解释为什么这样改
- 指出可能涉及的模块（尽量引用真实路径）
- 必须区分“仓库确认事实”和“AI 建议”
- 不要把推测描述成确定方案

### 6. 实现与验证
- 引导用户开始修改，并说明注意事项
- 帮助用户确认修改是否真正解决 Issue
- 验证步骤优先使用已确认的测试/运行命令；没有则明确未知

### 7. PR 提交
- 引导用户先进入现有“代码审查”功能检查修改
- 审查通过后再进入现有“PR 生成器”
- 结合真实 CONTRIBUTING / PR Template 说明项目要求；没有读到则写未确认
- 最终引导用户提交 GitHub PR
- recommendedIssues 保持空数组

## 证据与防幻觉规则（最高优先级）
1. 所有涉及具体文件、目录、命令、类、函数、配置、测试方式的内容，必须能在 README、额外仓库上下文、当前 Issue 上下文或 confirmedContext 中找到证据。
2. 没有证据就明确写成“未在仓库上下文中确认”或“建议检查……”，禁止编造。
3. 安装、启动、测试命令只能来自 README、CONTRIBUTING、package.json scripts、Makefile、pyproject、Cargo.toml、go.mod 等真实配置。
4. 不要输出通用课程式内容（例如“第 N 周学习某某技术”）；始终围绕当前 Issue。
5. 全部内容使用中文，面向开源新手。
6. 严格返回 JSON，不要有额外文字。`
}
