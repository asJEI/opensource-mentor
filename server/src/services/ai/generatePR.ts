import { config } from '../../config'
import type { Repository, Issue, PrDraft } from '../../types'
import { prDraftPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import { parseJsonSafely, validatePrDraftResult } from './parsers'
import { callLLM } from './providers'
import type { AIRuntime } from './types'

export async function generatePrDraft(
  repository: Repository,
  issue: Issue,
  options: {
    prType?: string
    additionalContext?: string
  } | undefined,
  runtime: AIRuntime,
): Promise<PrDraft> {
  if (!runtime.client) {
    return mockGeneratePrDraft(repository, issue, options)
  }

  try {
    const prompt = prDraftPrompt({
      repoName: repository.fullName,
      repoLanguage: repository.language,
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      issueLabels: issue.labels.map((l) => l.name),
      prType: options?.prType,
      additionalContext: options?.additionalContext,
    })

    const content = await callLLM(prompt, 0.7, runtime)
    const parsed = parseJsonSafely(content)
    return validatePrDraftResult(parsed, issue)
  } catch (err) {
    console.error('[AI] generatePrDraft failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockGeneratePrDraft(repository, issue, options)
    }
    throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
  }
}

export function mockGeneratePrDraft(
  repository: Repository,
  issue: Issue,
  options?: { prType?: string; additionalContext?: string },
): PrDraft {
  const isBug = issue.labels.some((l) => l.name.toLowerCase().includes('bug'))
  const isDocs = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
  const isFeature = issue.labels.some((l) =>
    l.name.toLowerCase().includes('feature') || l.name.toLowerCase().includes('enhancement'),
  )

  let type: PrDraft['type'] = 'fix'
  if (options?.prType) {
    type = options.prType as PrDraft['type']
  } else if (isDocs) {
    type = 'docs'
  } else if (isFeature) {
    type = 'feat'
  }

  const typePrefix = {
    feat: 'feat',
    fix: 'fix',
    docs: 'docs',
    refactor: 'refactor',
    test: 'test',
    chore: 'chore',
    style: 'style',
    perf: 'perf',
  }[type]

  return {
    title: `${typePrefix}: ${issue.title}`,
    description: `## 描述\n\n本 PR 解决了 #${issue.number} Issue。\n\n### 做了什么\n\n- 根据 Issue 描述实现了对应的改动\n- 遵循了项目的代码风格和贡献规范\n\n### 为什么这么做\n\n${issue.body ? issue.body.slice(0, 200) : '解决 Issue 中描述的问题'}\n\n### 如何验证\n\n1. 在本地拉取分支并运行项目\n2. 按照 Issue 中的步骤复现原问题\n3. 确认问题已修复且没有引入新问题\n4. 运行所有测试确保通过`,
    type,
    relatedIssue: `Closes #${issue.number}`,
    changes: [
      `根据 Issue #${issue.number} 的需求进行了相应修改`,
      '遵循了项目的代码风格和命名规范',
      '更新了相关的文档和注释（如适用）',
      '添加了必要的测试用例（如适用）',
    ],
    testingTips: [
      '在本地运行项目，按照 Issue 中的步骤验证功能',
      '运行项目的单元测试，确保没有破坏现有功能',
      '检查代码风格是否符合项目规范',
      '在不同的环境/浏览器中测试（如适用）',
    ],
    notes: [
      '这是 AI 生成的草稿，请根据实际情况调整',
      '建议先在本地充分测试后再提交',
      '如果改动较大，建议拆分成多个小 PR',
      '提交前请阅读项目的 CONTRIBUTING.md',
    ],
    confidence: 0.6,
    improvementSuggestions: [
      '补充具体的代码变更说明',
      '添加更详细的测试步骤和预期结果',
      '附上修改前后的对比截图（UI 改动）',
      '根据实际修改的文件细化 changes 列表',
    ],
  }
}
