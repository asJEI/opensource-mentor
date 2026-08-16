import {
  createLLMReview,
  createRuleReview,
  type RuleReviewInput,
  type RuleReviewResult,
} from '../../../../shared/core/code-review'
import type { AIRuntime } from './types'

/** Execute a real grounded LLM review through the request-scoped runtime. */
export async function reviewPr(
  params: RuleReviewInput,
  runtime: AIRuntime,
): Promise<RuleReviewResult> {
  if (!runtime.client) {
    return createRuleReview(params)
  }
  try {
    return await createLLMReview(params, {
      async complete({ system, user, temperature }) {
        const response = await runtime.client!.post(
          '/chat/completions',
          {
            model: runtime.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature,
            response_format: { type: 'json_object' },
          },
          { timeout: 120_000 },
        )
        return response.data?.choices?.[0]?.message?.content || '{}'
      },
    })
  } catch (error) {
    const status =
      typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
    if (status === 400 || status === 401 || status === 403 || status === 429) {
      throw error
    }
    console.error(
      '[PR-Review] LLM unavailable, using deterministic rules:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return createRuleReview(params)
  }
}
