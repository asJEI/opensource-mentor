import { describe, expect, it } from 'vitest'
import { detectLocale, isLocale, localizedMessages, requestLocale } from '../locale'
import { localizeGenerated } from '../generatedLocale'
import { createRuleReview } from './code-review/ruleReview'
import { localizedErrorMessage } from '../errors'

describe('locale negotiation', () => {
  it.each(['zh', 'zh-CN', 'zh-TW', 'ZH-hk'])('uses Chinese for %s', (language) => {
    expect(detectLocale(language)).toBe('zh-CN')
  })
  it.each(['en-GB', 'fr-FR', 'ja-JP', '', undefined])('uses English for %s', (language) => {
    expect(detectLocale(language)).toBe('en-US')
  })
  it('accepts only supported stored values and keeps legacy API clients Chinese', () => {
    expect(isLocale('en-US')).toBe(true)
    expect(isLocale('zh-CN')).toBe(true)
    expect(isLocale('fr-FR')).toBe(false)
    expect(requestLocale(null)).toBe('zh-CN')
    expect(requestLocale('zh-TW, en-US;q=0.8')).toBe('zh-CN')
    expect(requestLocale('fr-FR, zh-CN;q=0.8')).toBe('en-US')
  })
  it('preserves the meaning of legacy auth and validation errors without new error codes', () => {
    expect(localizedErrorMessage('未登录', 'INTERNAL_ERROR', 'en-US')).toBe('Sign in with GitHub first.')
    expect(localizedErrorMessage('请求体必须是合法 JSON', undefined, 'en-US')).toBe('Request body must be valid JSON.')
    expect(localizedErrorMessage('未登录', undefined, 'zh-CN')).toBe('未登录')
    expect(localizedErrorMessage('Upstream service unavailable', undefined, 'en-US')).toBe('Upstream service unavailable')
  })
})

describe('AI output language', () => {
  it.each(['zh-CN', 'en-US'] as const)('sets %s without changing conversation data', (locale) => {
    const messages = [
      { role: 'system', content: 'Return JSON using the requested schema.' },
      { role: 'user', content: 'Issue #12: 修复 bug; repo/name; const x = 1' },
      { role: 'assistant', content: 'Previous answer' },
    ]
    const result = localizedMessages(messages, locale)
    expect(result[0].content).toContain(locale)
    expect(result[0].content).toContain('schema enums')
    expect(result.slice(1)).toEqual(messages.slice(1))
    expect(messages[0].content).toBe('Return JSON using the requested schema.')
  })
  it('adds a system instruction when none exists', () => {
    expect(localizedMessages([{ role: 'user', content: 'Hi' }], 'en-US')[0].role).toBe('system')
  })
  it('localizes generated fallback text while preserving technical and original content', () => {
    const result = localizeGenerated({
      title: '获取项目', checkboxLabel: '我已经完成',
      evidence: ['公开 PR 12 个，公开 Issue 3 个'],
      commands: ['echo 我已经完成'], file: '文档',
      fileRefs: [{ path: '文档', reason: '建议阅读' }],
      summary: 'Original issue quote: 请保留这句话', severity: 'high',
    }, 'en-US')
    expect(result.title).toBe('Get the project')
    expect(result.evidence[0]).toBe('12 public PRs and 3 public issues')
    expect(result.commands).toEqual(['echo 我已经完成'])
    expect(result.file).toBe('文档')
    expect(result.fileRefs).toEqual([{ path: '文档', reason: 'Suggested reading' }])
    expect(result.summary).toBe('Original issue quote: 请保留这句话')
    expect(result.severity).toBe('high')
  })
  it('localizes deterministic review while preserving code, stats and original PR title', () => {
    const input = {
      prUrl: 'https://github.com/o/r/pull/1', prTitle: '修复 original issue', prBody: '',
      files: [{ filename: 'src/示例.ts', status: 'modified', additions: 120, deletions: 5,
        changes: 125, patch: '+const label = "中文原文"' }], diff: '',
    }
    const zh = createRuleReview(input)
    const en = createRuleReview({ ...input, locale: 'en-US' })
    expect(en.summary.title).toBe('Rule review report: 修复 original issue')
    expect(en.issues[0].title).toBe('Large changes in one file: consider separating responsibilities')
    expect(en.issues[0].yourCode).toBe('const label = "中文原文"')
    expect(en.stats).toEqual(zh.stats)
  })
})
