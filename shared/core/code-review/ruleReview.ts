import { reviewText } from './messages'
import type { Locale } from '../../locale'
/** Platform-neutral deterministic PR review shared by Workers and Express. */
export interface ReviewFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch: string
}

export interface RuleReviewInput {
  locale?: Locale
  prUrl: string
  prTitle: string
  prBody: string
  files: ReviewFile[]
  diff: string
  repoLanguage?: string
  repoFullName?: string
}

export interface RuleReviewResult {
  summary: Record<string, string | string[]>
  risks: {
    overallRiskLevel: 'low' | 'medium' | 'high'
    risks: Array<Record<string, unknown>>
  }
  issues: Array<Record<string, unknown>>
  praises: Array<Record<string, unknown>>
  tips: string[]
  stats: Record<
    'critical' | 'high' | 'medium' | 'low' | 'suggestion' | 'praise',
    number
  >
}

type FileKind = 'code' | 'style' | 'test' | 'docs' | 'config' | 'other'

function classify(filename: string): FileKind {
  const value = filename.toLowerCase()
  const extension = value.split('.').pop() || ''
  if (
    value.includes('test') ||
    value.includes('spec') ||
    value.includes('__tests__')
  )
    return 'test'
  if (value.endsWith('.md') || value.includes('docs/')) return 'docs'
  if (['json', 'yaml', 'yml'].includes(extension)) return 'config'
  if (['css', 'scss', 'less'].includes(extension)) return 'style'
  if (['ts', 'tsx', 'js', 'jsx'].includes(extension)) return 'code'
  return 'other'
}

function addedSnippet(patch: string, limit = 8): string {
  return (
    patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .slice(0, limit)
      .map((line) => line.slice(1))
      .join('\n') || '// 无可展示的新增代码'
  )
}

function createIssues(files: ReviewFile[], locale: Locale): Array<Record<string, unknown>> {
  const t = (key: string, values?: readonly unknown[]) => reviewText(locale, key, values)
  const issues: Array<Record<string, unknown>> = []
  const add = (value: Record<string, unknown>) => {
    if (issues.length < 6)
      issues.push({
        id: `issue-${String(issues.length + 1).padStart(3, '0')}`,
        ...value,
      })
  }
  for (const file of files) {
    const kind = classify(file.filename)
    const common = {
      file: file.filename,
      line: Math.max(1, Math.floor(file.additions / 2)),
      symbol: null,
      yourCode: addedSnippet(file.patch),
      confidence: 'medium',
      confidenceScore: 0.7,
    }
    if (kind === 'style' && file.additions > 20)
      add({
        ...common,
        severity: 'medium',
        category: 'best-practice',
        title: t("样式改动较大，建议检查复用边界"),
        description: t("{0} 新增 {1} 行样式。", [file.filename, file.additions]),
        suggestionCode: ':root { --primary-color: #0070f3; }',
        suggestionText: t("优先复用已有设计变量和通用样式。"),
        whyItMatters: t("重复样式会增加维护成本。"),
      })
    if (kind === 'test' && file.additions > 0)
      add({
        ...common,
        severity: 'suggestion',
        category: 'testing',
        title: t("建议覆盖边界和异常场景"),
        description: t("{0} 包含测试改动。", [file.filename]),
        suggestionCode: "it('handles invalid input', () => { /* ... */ })",
        suggestionText: t("补充失败路径测试。"),
        whyItMatters: t("失败路径测试能降低回归风险。"),
      })
    if (kind === 'code' && file.additions > 10)
      add({
        ...common,
        severity: file.additions > 100 ? 'medium' : 'suggestion',
        category: 'maintainability',
        title:
          file.additions > 100
            ? t("单文件改动较大，建议拆分职责")
            : t("建议确认类型与错误边界"),
        description: t("{0} 新增 {1} 行、删除 {2} 行。", [file.filename, file.additions, file.deletions]),
        suggestionCode: '// 拆分职责，并校验外部输入和失败路径',
        suggestionText: t("检查函数职责、输入校验和错误处理。"),
        whyItMatters: t("边界明确的单元更容易测试和维护。"),
      })
  }
  return issues
}

export function createRuleReview(input: RuleReviewInput): RuleReviewResult {
  const t = (key: string, values?: readonly unknown[]) => reviewText(input.locale ?? 'zh-CN', key, values)
  const { files, prTitle } = input
  const additions = files.reduce((sum, file) => sum + file.additions, 0)
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0)
  const kinds = files.map((file) => classify(file.filename))
  const codeFiles = kinds.filter((kind) => kind === 'code').length
  const issues = createIssues(files, input.locale ?? 'zh-CN')
  const risks: Array<Record<string, unknown>> = []
  if (additions > 200)
    risks.push({
      severity: 'high',
      category: 'maintainability',
      description: t("新增 {0} 行，建议拆分审查。", [additions]),
      affectedFiles: files.slice(0, 3).map((file) => file.filename),
      recommendation: t("拆成目标单一的小 PR。"),
      confidence: 'high',
      reasoning: t("大 PR 更难完整审查和安全回滚。"),
    })
  if (codeFiles > 3)
    risks.push({
      severity: 'medium',
      category: 'testing',
      description: t("修改了 {0} 个代码文件。", [codeFiles]),
      affectedFiles: files
        .filter((file) => classify(file.filename) === 'code')
        .slice(0, 3)
        .map((file) => file.filename),
      recommendation: t("运行完整测试并补充失败路径。"),
      confidence: 'medium',
      reasoning: t("跨文件改动扩大了回归范围。"),
    })
  if (!risks.length)
    risks.push({
      severity: 'low',
      category: 'maintainability',
      description: t("本次改动范围适中。"),
      affectedFiles: files.slice(0, 2).map((file) => file.filename),
      recommendation: t("合并后关注运行指标。"),
      confidence: 'high',
      reasoning: t("规则未发现明显的范围风险。"),
    })
  const praises: Array<Record<string, unknown>> = []
  const testFile = files.find((file) => classify(file.filename) === 'test')
  const docsFile = files.find((file) => classify(file.filename) === 'docs')
  if (testFile)
    praises.push({
      id: 'praise-001',
      title: t("包含测试改动"),
      description: t("已同步修改 {0}。", [testFile.filename]),
      file: testFile.filename,
      codeSnippet: addedSnippet(testFile.patch),
      whyItMatters: t("测试为重构提供安全网。"),
    })
  if (docsFile)
    praises.push({
      id: `praise-${String(praises.length + 1).padStart(3, '0')}`,
      title: t("包含文档改动"),
      description: t("已同步修改 {0}。", [docsFile.filename]),
      file: docsFile.filename,
      codeSnippet: addedSnippet(docsFile.patch),
      whyItMatters: t("同步文档能降低维护成本。"),
    })
  const stats = {
    critical: 0,
    high: 0,
    medium: issues.filter((item) => item.severity === 'medium').length,
    low: 0,
    suggestion: issues.filter((item) => item.severity === 'suggestion').length,
    praise: praises.length,
  }
  const overallRiskLevel = risks.some((risk) => risk.severity === 'high')
    ? 'high'
    : risks.some((risk) => risk.severity === 'medium')
      ? 'medium'
      : 'low'
  const labels: Record<FileKind, string> = {
    code: t("核心业务逻辑"),
    style: t("UI 样式"),
    test: t("测试套件"),
    docs: t("文档"),
    config: t("配置"),
    other: t("其他模块"),
  }
  return {
    summary: {
      title: t("规则审查报告：{0}", [prTitle || t('PR 审查')]),
      summary: t("该 PR 修改 {0} 个文件，新增 {1} 行，删除 {2} 行。以下结论来自确定性规则检查，不代表 LLM 语义审查。", [files.length, additions, deletions]),
      keyChanges: files
        .slice(0, 4)
        .map(
          (file) =>
            `${file.status === 'added' ? t("新增") : file.status === 'removed' ? t("删除") : t("修改")} ${file.filename}（+${file.additions} -${file.deletions}）`,
        ),
      affectedSystems: Array.from(
        new Set(kinds.map((kind) => labels[kind])),
      ).slice(0, 4),
      architecturalImpact:
        overallRiskLevel === 'high'
          ? t("改动范围较大，建议拆分并增加人工审查。")
          : t("未从改动规模中发现明显的高风险架构信号。"),
      overallFeedback: t("规则引擎只提供基础工程提示，请结合项目上下文人工复核。"),
    },
    risks: { overallRiskLevel, risks },
    issues,
    praises,
    tips: [
      t("规则审查适合发现规模和结构信号；安全、正确性和业务语义仍需人工或 LLM 深度审查。"),
    ],
    stats,
  }
}
