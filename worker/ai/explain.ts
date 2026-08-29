import { ApiError } from '../http'
import type { AIClient } from './client'
import { ensureStringArray, parseJsonSafely } from './json'
import { issueExplainPrompt, systemPrompt } from './prompts/explain'

export interface IssueExplainResult {
  summary: string
  difficulty: 'easy' | 'medium' | 'hard'
  confirmedContext: string[]
  knowledge: string[]
  steps: string[]
  possibleAreasToInspect: string[]
  estimatedTime: string
  tips: string[]
}

export interface ExplainIssueInput {
  repository: {
    fullName: string
    description?: string | null
    language?: string | null
    stars?: number
  }
  issue: {
    number: number
    title: string
    body?: string | null
    labels?: Array<{ name: string; color?: string }>
  }
}

function validateExplainResult(
  parsed: Record<string, unknown>,
): IssueExplainResult {
  const difficulty = String(parsed.difficulty || 'medium').toLowerCase()
  const validDifficulty = ['easy', 'medium', 'hard'].includes(difficulty)
    ? (difficulty as 'easy' | 'medium' | 'hard')
    : 'medium'

  return {
    summary: String(parsed.summary || '暂无总结'),
    difficulty: validDifficulty,
    confirmedContext: ensureStringArray(parsed.confirmedContext, [
      '已确认仓库名称和 Issue 标题。',
    ]),
    knowledge: ensureStringArray(parsed.knowledge, [
      '了解项目基本架构',
      '熟悉 Git 基本操作',
    ]),
    steps: ensureStringArray(parsed.steps, [
      '阅读 Issue 描述，理解需求',
      '在本地复现问题',
      '查找相关代码',
      '实现修复',
      '提交 PR',
    ]),
    possibleAreasToInspect: ensureStringArray(
      parsed.possibleAreasToInspect,
      [
        '建议先阅读 README 和贡献指南。',
        '根据 Issue 描述查找相关功能入口和测试说明。',
      ],
    ),
    estimatedTime: String(parsed.estimatedTime || '2-4 小时'),
    tips: ensureStringArray(parsed.tips, [
      '先看 CONTRIBUTING.md 了解贡献规范',
      '写代码前先和维护者确认方案',
      '提交后耐心等待 Review',
    ]),
  }
}

export async function explainIssue(
  client: AIClient,
  input: ExplainIssueInput,
): Promise<IssueExplainResult> {
  const prompt = issueExplainPrompt({
    repoName: input.repository.fullName,
    repoDescription: input.repository.description || null,
    repoLanguage: input.repository.language || null,
    issueTitle: input.issue.title,
    issueBody: input.issue.body || null,
    issueLabels: (input.issue.labels || []).map((label) => label.name),
    issueNumber: input.issue.number,
  })

  try {
    const content = await client.chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      topP: 0.9,
      responseFormat: { type: 'json_object' },
    })
    return validateExplainResult(parseJsonSafely(content))
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(
      '[AI] explainIssue failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    throw new ApiError('AI 服务暂时不可用，请稍后重试', 503, {
      errorCode: 'AI_PROVIDER_ERROR',
    })
  }
}
