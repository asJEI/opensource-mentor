export function repoAnalysisPrompt(params: {
  repoName: string
  repoDescription: string | null
  repoLanguage: string | null
  stars: number
  forks: number
  openIssues: number
  topics: string[]
  license: string | null
  createdAt: string
  updatedAt: string
  readme: string
}): string {
  const {
    repoName,
    repoDescription,
    repoLanguage,
    stars,
    forks,
    openIssues,
    topics,
    license,
    createdAt,
    updatedAt,
    readme,
  } = params

  const readmeSnippet = readme ? readme.slice(0, 4000) : '（无 README）'

  return `你是一位资深开源贡献导师，擅长从新人的角度分析开源项目。

请分析下面这个 GitHub 仓库，给出全面但易懂的评估，帮助新人判断这个项目是否适合自己参与。

## 仓库信息
- 仓库: ${repoName}
- 描述: ${repoDescription || '暂无'}
- 主要语言: ${repoLanguage || '未知'}
- Stars: ${stars}
- Forks: ${forks}
- 开放 Issue 数: ${openIssues}
- Topics: ${topics.length > 0 ? topics.join(', ') : '无'}
- License: ${license || '未知'}
- 创建时间: ${createdAt}
- 最后更新: ${updatedAt}

## README 摘要（前 4000 字符）
${readmeSnippet}

## 要求
请以 JSON 格式返回，包含以下字段：

{
  "overview": "项目概述，2-3 句话，说明这个项目是做什么的、解决什么问题",
  "techStack": {
    "primaryLanguage": "主要编程语言",
    "coreTechnologies": ["核心技术/框架，3-5 个"],
    "buildTools": ["构建工具，1-3 个"],
    "testFrameworks": ["测试框架，1-3 个"],
    "architecture": "架构模式简述，如单体/微服务/库/框架/工具等"
  },
  "activity": {
    "level": "very-active | active | moderate | low | inactive",
    "commitFrequency": "最近提交频率描述，如'每天多次提交'、'每周几次'等",
    "maintainerResponsiveness": "维护者响应速度描述",
    "lastMajorUpdate": "最近一次重大更新的时间或描述"
  },
  "beginnerFriendliness": {
    "level": "very-friendly | friendly | moderate | challenging | hard",
    "score": 0-10 之间的数字，新人友好度评分,
    "friendlyFactors": ["对新人友好的因素，3-5 条"],
    "challengingFactors": ["对新人有挑战的因素，2-4 条"]
  },
  "domains": ["主要技术领域/方向标签，4-6 个"],
  "gettingStartedTips": ["给新人的入门建议，4-6 条，具体可操作"],
  "contributionAreas": [
    {
      "name": "贡献领域名称，如'文档改进'、'Bug 修复'",
      "description": "这个领域主要做什么",
      "difficulty": "easy | medium | hard",
      "whyGoodForBeginners": "为什么适合新人入门"
    }
  ],
  "confidence": 0-1 之间的数字，你对这次分析的置信度
}

## 注意事项
1. 站在新人的角度思考，不要假设读者有丰富的开源经验
2. 评分要客观合理，不要都是满分
3. contributionAreas 至少 3 个，最多 5 个
4. gettingStartedTips 要具体，如"先阅读 CONTRIBUTING.md"、"从 good first issue 开始"等
5. 严格返回 JSON，不要有额外文字
6. 所有内容使用中文`
}
