import type { UserProfileContext } from '../types'

export function issueRecommendationPrompt(params: {
  repoName: string
  repoLanguage: string | null
  repoDescription: string | null
  repoTopics: string[]
  userProfile: UserProfileContext
  issues: Array<{
    number: number
    title: string
    body: string | null
    labels: string[]
    comments: number
    createdAt: string
    updatedAt: string
    author: string
  }>
}): string {
  const {
    repoName,
    repoLanguage,
    repoDescription,
    repoTopics,
    userProfile,
    issues,
  } = params

  const languageLabels: Record<
    UserProfileContext['programmingLanguages'][number],
    string
  > = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    go: 'Go',
    rust: 'Rust',
    cpp: 'C/C++',
    other: '其他',
  }
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
  const experienceLabels: Record<
    UserProfileContext['experienceLevel'],
    string
  > = {
    beginner: '第一次接触开源',
    some_experience: '写过一些代码',
    project_experience: '有完整项目经验',
  }
  const hasPersonalProfile = userProfile.profileSetupStatus === 'completed'
  const profileText = hasPersonalProfile
    ? `- 开发经验: ${experienceLabels[userProfile.experienceLevel]}
- 编程语言: ${
        userProfile.programmingLanguages.length > 0
          ? userProfile.programmingLanguages
              .map((item) => languageLabels[item])
              .join(', ')
          : '未指定'
      }
- 兴趣方向: ${
        userProfile.interests.length > 0
          ? userProfile.interests.map((item) => interestLabels[item]).join(', ')
          : '未指定'
      }
- 学习目标: ${
        userProfile.goals.length > 0
          ? userProfile.goals.map((item) => goalLabels[item]).join(', ')
          : '未指定'
      }`
    : `- 用户未提供个性化画像，按“第一次接触开源”的纯新手评估
- 不得声称用户掌握某种语言、技术或对某个方向感兴趣
- 推荐理由应明确说明：“这是一个适合开源新手的 Issue。”`

  const issuesText = issues
    .map(
      (issue, idx) => `
### Issue #${issue.number} (索引: ${idx})
- 标题: ${issue.title}
- 标签: ${issue.labels.join(', ') || '无'}
- 评论数: ${issue.comments}
- 创建时间: ${issue.createdAt}
- 更新时间: ${issue.updatedAt}
- 作者: ${issue.author}
- 内容:
${issue.body ? issue.body.slice(0, 500) : '（无内容）'}
`,
    )
    .join('\n')

  return `你是一位开源贡献匹配专家，擅长从新人角度评估 Issue 的适合度。

请为下面这组 Issue 计算推荐分数，找出最适合开源新人入手的 Issue。

## 仓库信息
- 仓库: ${repoName}
- 描述: ${repoDescription || '暂无'}
- 主要语言: ${repoLanguage || '未知'}
- Topics/技术领域: ${repoTopics.length > 0 ? repoTopics.join(', ') : '未知'}

## 用户画像
${profileText}

## 待评估 Issue 列表（共 ${issues.length} 个）
${issuesText}

## 评分维度说明
请从以下 5 个维度为每个 Issue 打分（0-100 分）：

1. **难度匹配 (difficultyMatch)**: Issue 难度与用户经验是否匹配
   - good first issue / beginner 标签 → 高分
   - 文档/拼写/样式类 → 高分
   - 纯新手遇到核心架构/复杂算法 → 低分
   - 有完整项目经验时，可适当提高中等工程任务的分数

2. **技术匹配 (skillMatch)**: Issue 涉及的语言、文件和领域是否匹配画像
   - 与用户编程语言和兴趣方向明确匹配 → 高分并说明证据
   - 用户未提供语言或兴趣时，不得虚构匹配
   - 仓库主语言只能作为参考，结合 Issue 标题、正文和标签判断

3. **影响价值 (impactScore)**: 完成后的贡献价值和认可度
   - 有明确需求、被多人关注 → 高分
   - 争议性大、可能被拒绝 → 低分

4. **活跃度 (activityScore)**: Issue 的活跃程度和维护者关注度
   - 最近更新、有维护者参与 → 高分
   - 长期无人问津 → 低分

5. **新人友好 (beginnerFriendlyScore)**: 综合新人友好度
   - 有清晰的描述、重现步骤 → 高分
   - 描述模糊、信息不足 → 低分

## 要求
请以 JSON 格式返回：

{
  "summary": "对这批 Issue 的整体评价和推荐说明，2-3 句话",
  "items": [
    {
      "index": Issue 在列表中的索引数字,
      "difficulty": "easy | medium | hard",
      "matchScore": 综合匹配分数（0-100，整数）,
      "confidence": 你对这个评分的置信度（0-1）,
      "matchReasons": ["画像匹配理由，2-4 条，要具体"],
      "matchDetails": {
        "difficultyMatch": 0-100 整数,
        "skillMatch": 0-100 整数,
        "impactScore": 0-100 整数,
        "activityScore": 0-100 整数,
        "beginnerFriendlyScore": 0-100 整数
      }
    }
  ]
}

## 注意事项
1. 同时考虑用户语言、经验、兴趣、目标以及仓库技术栈、Issue 难度和涉及领域
2. matchReasons 要具体，如"该 Issue 使用 TypeScript"、"属于你感兴趣的前端方向"
3. 只有画像中真实存在的信息才能写成“你掌握”或“你感兴趣”
4. 用户未完成或跳过画像时，只按纯新手推荐，并至少包含“这是一个适合开源新手的 Issue。”
5. 分数要有区分度，不要都集中在 80-90 分
6. 按 matchScore 从高到低排序返回
7. 严格返回 JSON，不要有额外文字
8. 所有内容使用中文`
}
