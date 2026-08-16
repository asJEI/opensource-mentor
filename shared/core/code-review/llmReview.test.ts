import { describe, expect, it } from 'vitest'
import { buildReviewContext, createLLMReview } from './llmReview'
import type { RuleReviewInput } from './ruleReview'

const input: RuleReviewInput = {
  prUrl: 'https://github.com/example/project/pull/1',
  prTitle: 'Fix authentication check',
  prBody: 'Reject expired sessions.',
  diff: '',
  repoFullName: 'example/project',
  repoLanguage: 'TypeScript',
  files: [
    {
      filename: 'src/auth.ts',
      status: 'modified',
      additions: 4,
      deletions: 1,
      changes: 5,
      patch: '@@ -10,1 +10,4 @@\n+if (session.expired) return false',
    },
  ],
}

describe('createLLMReview', () => {
  it('uses the real client and normalizes grounded structured output', async () => {
    let calls = 0
    const result = await createLLMReview(input, {
      async complete() {
        calls += 1
        return JSON.stringify({
          summary: {
            title: 'Auth review',
            summary: 'Expired sessions are rejected.',
            keyChanges: ['Adds expiry check'],
            affectedSystems: ['Authentication'],
            architecturalImpact: 'Low',
            overallFeedback: 'Good direction.',
          },
          risks: { overallRiskLevel: 'medium', risks: [] },
          issues: [
            {
              severity: 'high',
              category: 'security',
              title: 'Grounded',
              description: 'Check server time.',
              file: 'src/auth.ts',
              line: 11,
              confidence: 'high',
              confidenceScore: 0.9,
            },
            {
              severity: 'critical',
              category: 'security',
              title: 'Hallucinated',
              file: 'src/missing.ts',
              line: 1,
            },
          ],
          praises: [],
          tips: ['Add an expiry boundary test'],
        })
      },
    })
    expect(calls).toBe(1)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.file).toBe('src/auth.ts')
    expect(result.stats.high).toBe(1)
  })

  it('bounds the prompt context and marks PR content as data', () => {
    const context = buildReviewContext({
      ...input,
      files: [{ ...input.files[0]!, patch: `+${'x'.repeat(100_000)}` }],
    })
    expect(context.length).toBeLessThanOrEqual(48_000)
    expect(context).toContain('FILE: src/auth.ts')
  })
})
