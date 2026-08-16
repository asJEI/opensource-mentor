export function prDraftPrompt(params: {
  repoName: string
  repoLanguage: string | null
  issueNumber: number
  issueTitle: string
  issueBody: string | null
  issueLabels: string[]
  prType?: string
  additionalContext?: string
}): string {
  const {
    repoName,
    repoLanguage,
    issueNumber,
    issueTitle,
    issueBody,
    issueLabels,
    prType,
    additionalContext,
  } = params

  return `你是一位资深开源贡献者和 PR 撰写专家。

请根据下面的 Issue 信息，生成一份高质量的 Pull Request 草稿。
PR 应该清晰、专业、符合开源社区规范。

## 仓库信息
- 仓库: ${repoName}
- 主要语言: ${repoLanguage || '未知'}

## Issue 信息
- 编号: #${issueNumber}
- 标题: ${issueTitle}
- 标签: ${issueLabels.join(', ') || '无'}
${prType ? `- 预期 PR 类型: ${prType}` : ''}
${additionalContext ? `- 额外上下文: ${additionalContext}` : ''}

## Issue 内容
${issueBody || '（无详细内容）'}

## 要求
请以 JSON 格式返回 PR 草稿：

{
  "title": "PR 标题，简洁明了，遵循 Conventional Commits 规范，如 feat: xxx / fix: xxx / docs: xxx",
  "description": "PR 描述，详细说明做了什么、为什么这么做、怎么验证的（Markdown 格式的纯文本，用换行和列表）",
  "type": "feat | fix | docs | refactor | test | chore | style | perf",
  "relatedIssue": "关联的 Issue，如 '#${issueNumber}'",
  "changes": ["主要变更点列表，4-8 条，具体描述"],
  "testingTips": ["测试建议，3-5 条，告诉评审者如何验证"],
  "notes": ["注意事项/风险点，2-4 条，如'可能影响 X 功能'、'需要后端配合'等"],
  "confidence": 0-1 之间的数字，PR 草稿的质量置信度,
  "improvementSuggestions": ["可以改进的地方，2-3 条，如实说明 AI 生成的局限性"]
}

## 注意事项
1. PR 标题遵循 Conventional Commits 规范（type: description）
2. 描述要包含：做了什么 → 为什么这么做 → 如何验证
3. changes 要具体，不要写"修复了 bug"这种笼统的话
4. testingTips 要实用，告诉维护者怎么验证你的改动
5. notes 要诚实说明可能的风险或未完成的部分
6. improvementSuggestions 要客观，说明 AI 生成的草稿哪里需要人工调整
7. confidence 要合理，信息越少置信度越低
8. 严格返回 JSON，不要有额外文字
9. 所有内容使用中文`
}
