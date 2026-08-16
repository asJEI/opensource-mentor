import { describe, expect, it } from 'vitest'
import { createRuleReview, type RuleReviewInput } from './ruleReview'

const input: RuleReviewInput = {
  prUrl: 'https://github.com/example/project/pull/1',
  prTitle: 'Refactor request handling',
  prBody: '',
  diff: '',
  files: [
    {
      filename: 'src/request.ts',
      status: 'modified',
      additions: 120,
      deletions: 20,
      changes: 140,
      patch: '+export function handleRequest() {}',
    },
    {
      filename: 'src/request.test.ts',
      status: 'added',
      additions: 30,
      deletions: 0,
      changes: 30,
      patch: "+it('handles invalid input', () => {})",
    },
  ],
}

describe('createRuleReview', () => {
  it('is deterministic for identical inputs', () => {
    expect(createRuleReview(input)).toEqual(createRuleReview(input))
  })

  it('labels the result as rules-based rather than LLM-generated', () => {
    const result = createRuleReview(input)
    expect(result.summary.title).toContain('规则审查')
    expect(result.summary.summary).toContain('不代表 LLM 语义审查')
  })

  it('derives stable issues, praise, and statistics from file metadata', () => {
    const result = createRuleReview(input)
    expect(result.issues).toHaveLength(2)
    expect(result.praises).toHaveLength(1)
    expect(result.stats.medium).toBe(1)
    expect(result.stats.suggestion).toBe(1)
    expect(result.stats.praise).toBe(1)
  })
})
