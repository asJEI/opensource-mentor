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
  } = params

  const readmeSnippet = readme ? readme.slice(0, 3000) : '（无 README）'
  const issuesText =
    goodFirstIssues.length > 0
      ? goodFirstIssues
          .map(
            (i) =>
              `  - #${i.number} ${i.title} [${i.labels.join(', ')}]`,
          )
          .join('\n')
      : '  暂无 good first issue'

  const experienceDescription = {
    beginner: '第一次接触开源，需要从项目理解和贡献流程开始',
    some_experience: '写过一些代码，可以较快进入代码阅读和简单实践',
    project_experience:
      '有完整项目经验，可跳过基础编程和 Git 入门，直接进入工程贡献',
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
  const phaseGuidance = hasPersonalProfile
    ? {
        beginner:
          '生成 5-7 个阶段；前四个阶段依次覆盖理解项目、阅读 Issue、简单文档或测试贡献、第一次代码贡献',
        some_experience:
          '生成 4-6 个阶段；简化 Git 基础，但保留项目理解、Issue 分析和第一次真实贡献',
        project_experience:
          '生成 3-5 个阶段；跳过基础编程和 Git 教程，从架构理解、测试或 Bug 修复开始',
      }[userProfile.experienceLevel]
    : '生成 5-7 个阶段；按纯新手路径从理解项目和开源流程开始'

  return `你是一位资深开源贡献导师，擅长为不同水平的开发者定制开源项目学习路线图。

请为下面这个开源项目生成一份个性化的学习路线图，帮助用户从当前水平逐步成长为活跃贡献者。

设计理念参考 developer-roadmap：循序渐进、每个阶段有明确目标、有可量化的完成标准、理论与实践结合。

## 仓库信息
- 仓库: ${repoName}
- 描述: ${repoDescription || '暂无'}
- 主要语言: ${repoLanguage || '未知'}
- Topics: ${repoTopics.length > 0 ? repoTopics.join(', ') : '无'}
- Stars: ${stars}

## 用户画像
${profileText}

## 适合新人的 Issue
${issuesText}

## README 摘要（前 3000 字符）
${readmeSnippet}

## 要求
请以 JSON 格式返回路线图：

{
  "title": "路线图标题，如 'XXX 项目贡献者成长路线图'",
  "description": "路线图简介，2-3 句话，说明这个路线图能帮助用户达成什么目标",
  "totalEstimatedTime": "总预计学习时间，如 '2-4 周'、'1-2 个月'",
  "phases": [
    {
      "phase": 阶段编号（1-based）,
      "title": "阶段标题",
      "goal": "阶段目标，1-2 句话",
      "learningItems": ["学习内容列表，4-6 条具体的知识点"],
      "recommendedIssues": ["推荐实践的 Issue，用 '#编号 标题' 格式，2-3 个"],
      "estimatedDuration": "预计完成时间，如 '3-5 天'",
      "difficulty": "easy | medium | hard",
      "completionCriteria": ["完成标准，3-4 条可量化的判断标准"],
      "resources": ["推荐学习资源名称，3-5 个"]
    }
  ],
  "tips": ["给学习者的整体建议，4-6 条，要具体实用"],
  "confidence": 0-1 之间的数字，路线图的质量置信度
}

## 注意事项
1. ${phaseGuidance}
2. 路线必须根据经验、编程语言、兴趣和目标改变具体起点、学习内容与实践任务，不能只在标题中提及画像
3. 每个阶段都要有推荐实践的 Issue（如果有 good first issue 优先推荐）
4. 完成标准要可量化，如"能独立搭建开发环境并跑通测试"、"提交了第一个文档类 PR"
5. 学习内容要结合仓库主要语言、Topics 和 README，具体到技术或实践动作
6. 用户未掌握仓库语言且目标是学习新技术时，要加入语言补齐阶段；已掌握时不要重复基础教程
7. 兴趣方向应影响优先实践类型，学习目标应影响路线完成里程碑
8. 严格返回 JSON，不要有额外文字
9. 所有内容使用中文`
}
