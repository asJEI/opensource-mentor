/**
 * Cloudflare Worker API entry.
 * Task 4: GitHub APIs. Task 5–6: AI + code-review endpoints.
 */

import { redactSecrets } from '../shared/byok'
import {
  handleAnalyzeRepo,
  handleChat,
  handleExplainIssue,
  handleGeneratePr,
  handleGenerateRoadmap,
  handleGenerateRoadmapPhase,
  handleListAIModels,
  handlePrepareRoadmapContext,
  handleRecommendIssues,
  handleTestAIConnection,
} from './ai/routes'
import {
  handleCodeReviewHealth,
  handleCreateReview,
  handleGetReview,
} from './code-review/routes'
import {
  handleGetMe,
  handleLogout,
  handleUpdateDeveloperProfile,
} from './auth/routes'
import { getPlatformConfigStatus, type PlatformEnv } from './config'
import {
  handleGetIssues,
  handleGetRepository,
  handleGetRepositoryBranches,
  handleTestGitHubConnection,
} from './github/routes'
import {
  handleAnalyzeCandidateIssue,
  handleGetCandidateIssues,
} from './github/candidateIssues'
import {
  handleGitHubOAuthCallback,
  handleGitHubOAuthStart,
} from './github/oauth'
import { json, toErrorResponse } from './http'

export default {
  async fetch(request: Request, env: PlatformEnv): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({
          success: true,
          data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            runtime: 'cloudflare-workers',
            platform: getPlatformConfigStatus(env),
          },
        })
      }

      if (url.pathname === '/api/repository/branches' && request.method === 'GET') {
        return await handleGetRepositoryBranches(request, env)
      }
      if (url.pathname === '/api/repository' && request.method === 'GET') {
        return await handleGetRepository(request, env)
      }

      if (url.pathname === '/api/issues' && request.method === 'GET') {
        return await handleGetIssues(request, env)
      }

      if (
        url.pathname === '/api/issues/candidates' &&
        request.method === 'GET'
      ) {
        return await handleGetCandidateIssues(request, env)
      }

      if (
        url.pathname === '/api/issues/candidates/analyze' &&
        request.method === 'POST'
      ) {
        return await handleAnalyzeCandidateIssue(request, env)
      }

      if (url.pathname === '/api/me' && request.method === 'GET') {
        return await handleGetMe(request, env)
      }

      if (url.pathname === '/api/me/logout' && request.method === 'POST') {
        return await handleLogout(request)
      }

      if (
        url.pathname === '/api/me/developer-profile' &&
        request.method === 'PATCH'
      ) {
        return await handleUpdateDeveloperProfile(request, env)
      }

      if (
        url.pathname === '/api/github/test-connection' &&
        request.method === 'POST'
      ) {
        return await handleTestGitHubConnection(request, env)
      }

      if (
        url.pathname === '/api/auth/github/start' &&
        request.method === 'GET'
      ) {
        return handleGitHubOAuthStart(request, env)
      }

      if (
        url.pathname === '/api/auth/github/callback' &&
        request.method === 'GET'
      ) {
        return await handleGitHubOAuthCallback(request, env)
      }

      if (url.pathname === '/api/ai/explain' && request.method === 'POST') {
        return await handleExplainIssue(request, env)
      }

      if (
        url.pathname === '/api/ai/test-connection' &&
        request.method === 'POST'
      ) {
        return await handleTestAIConnection(request, env)
      }

      if (url.pathname === '/api/ai/models' && request.method === 'POST') {
        return await handleListAIModels(request, env)
      }

      if (
        url.pathname === '/api/ai/analyze-repo' &&
        request.method === 'POST'
      ) {
        return await handleAnalyzeRepo(request, env)
      }

      if (
        url.pathname === '/api/ai/recommend-issues' &&
        request.method === 'POST'
      ) {
        return await handleRecommendIssues(request, env)
      }

      if (
        url.pathname === '/api/ai/generate-roadmap-context' &&
        request.method === 'POST'
      ) {
        return await handlePrepareRoadmapContext(request, env)
      }

      if (
        url.pathname === '/api/ai/generate-roadmap-phase' &&
        request.method === 'POST'
      ) {
        return await handleGenerateRoadmapPhase(request, env)
      }

      if (
        url.pathname === '/api/ai/generate-roadmap' &&
        request.method === 'POST'
      ) {
        return await handleGenerateRoadmap(request, env)
      }

      if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
        return await handleChat(request, env)
      }

      if (url.pathname === '/api/ai/generate-pr' && request.method === 'POST') {
        return await handleGeneratePr(request, env)
      }

      if (
        url.pathname === '/api/code-review/reviews' &&
        request.method === 'POST'
      ) {
        return await handleCreateReview(request, env)
      }

      const reviewMatch = url.pathname.match(
        /^\/api\/code-review\/reviews\/([^/]+)$/,
      )
      if (reviewMatch && request.method === 'GET') {
        return await handleGetReview(
          request,
          env,
          decodeURIComponent(reviewMatch[1]),
        )
      }

      if (
        url.pathname === '/api/code-review/health' &&
        request.method === 'GET'
      ) {
        return await handleCodeReviewHealth(request, env)
      }

      if (
        url.pathname === '/api/poc/external-fetch' &&
        request.method === 'GET'
      ) {
        const target = 'https://example.com/'
        const startedAt = Date.now()

        try {
          const upstream = await fetch(target, {
            method: 'GET',
            redirect: 'follow',
            headers: { Accept: 'text/html' },
            signal: AbortSignal.timeout(10_000),
          })
          const body = await upstream.text()

          return json({
            success: true,
            data: {
              ok: upstream.ok,
              status: upstream.status,
              latencyMs: Date.now() - startedAt,
              target,
              bodyPreview: body.slice(0, 80),
            },
          })
        } catch (error) {
          return json(
            {
              success: false,
              message:
                error instanceof Error
                  ? error.message
                  : 'external fetch failed',
              code: 502,
            },
            502,
          )
        }
      }

      if (url.pathname.startsWith('/api/')) {
        return json(
          {
            success: false,
            data: null,
            message: `PoC stub: ${request.method} ${url.pathname} not implemented`,
            code: 404,
          },
          404,
        )
      }

      return new Response(null, { status: 404 })
    } catch (error) {
      // Never log request headers/body (may contain GitHub/AI secrets).
      console.error(
        `[api] ${request.method} ${url.pathname} failed:`,
        redactSecrets(error instanceof Error ? error.message : 'unknown error'),
      )
      return toErrorResponse(error)
    }
  },
} satisfies ExportedHandler<PlatformEnv>
