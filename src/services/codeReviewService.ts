import { bffGet, bffPost } from './request'
import type {
  ReviewStatus,
  ReviewProgress,
  ReviewResult,
  ReviewJobRecord,
  ReviewIssue,
  ReviewSummary,
  RiskReviewReport,
  RiskItem,
  PraiseItem,
  CreateReviewRequest,
  ReviewJobArtifacts,
  ReviewChangedFile,
} from '@/types'

class CodeReviewService {
  /**
   * 创建审查任务
   * POST /api/code-review/reviews
   */
  async createReview(payload: CreateReviewRequest): Promise<ReviewJobRecord> {
    const data = await bffPost<any>('/code-review/reviews', payload, {
      timeout: 130_000,
    })
    return this.mapReviewJobRecord(data)
  }

  async getReview(reviewId: string): Promise<ReviewJobRecord> {
    const data = await bffGet<any>(`/code-review/reviews/${reviewId}`)
    return this.mapReviewJobRecord(data)
  }

  async healthCheck(): Promise<{ ok: boolean }> {
    const data = await bffGet<any>('/code-review/health')
    return {
      ok: data.ok ?? false,
    }
  }

  private mapReviewProgress(data: any): ReviewProgress {
    return {
      percent: data.percent ?? 0,
      phases: {
        summary:
          (data.phases?.summary as ReviewProgress['phases']['summary']) ||
          'pending',
        risk:
          (data.phases?.risk as ReviewProgress['phases']['risk']) || 'pending',
        comments:
          (data.phases?.comments as ReviewProgress['phases']['comments']) ||
          'pending',
      },
      lastEventAt: data.lastEventAt || null,
    }
  }

  private mapReviewSummary(data: any): ReviewSummary {
    return {
      title: data.title || '',
      summary: data.summary || '',
      keyChanges: data.keyChanges || [],
      affectedSystems: data.affectedSystems || [],
      architecturalImpact: data.architecturalImpact || '',
      overallFeedback: data.overallFeedback || '',
    }
  }

  private mapRiskItem(data: any): RiskItem {
    return {
      severity: data.severity || 'low',
      category: data.category || 'other',
      description: data.description || '',
      affectedFiles: data.affectedFiles || [],
      recommendation: data.recommendation || '',
      confidence: data.confidence || 'medium',
      reasoning: data.reasoning || '',
    }
  }

  private mapRiskReviewReport(data: any): RiskReviewReport {
    return {
      overallRiskLevel: data.overallRiskLevel || 'low',
      risks: (data.risks || []).map((r: any) => this.mapRiskItem(r)),
    }
  }

  private mapReviewIssue(data: any): ReviewIssue {
    return {
      id: data.id || String(Math.random()),
      severity: data.severity || 'low',
      category: data.category || 'other',
      title: data.title || '',
      description: data.description || '',
      file: data.file || '',
      line: data.line ?? null,
      symbol: data.symbol || null,
      yourCode: data.yourCode || '',
      suggestionCode: data.suggestionCode || '',
      suggestionText: data.suggestionText || '',
      whyItMatters: data.whyItMatters || '',
      confidence: data.confidence || 'medium',
      confidenceScore: data.confidenceScore ?? 0,
    }
  }

  private mapPraiseItem(data: any): PraiseItem {
    return {
      id: data.id || String(Math.random()),
      title: data.title || '',
      description: data.description || '',
      file: data.file || '',
      codeSnippet: data.codeSnippet || '',
      whyItMatters: data.whyItMatters || '',
    }
  }

  private mapReviewResult(data: any): ReviewResult {
    return {
      summary: this.mapReviewSummary(data.summary || {}),
      risks: this.mapRiskReviewReport(data.risks || {}),
      issues: (data.issues || []).map((i: any) => this.mapReviewIssue(i)),
      praises: (data.praises || []).map((p: any) => this.mapPraiseItem(p)),
      tips: data.tips || [],
      stats: {
        critical: data.stats?.critical ?? 0,
        high: data.stats?.high ?? 0,
        medium: data.stats?.medium ?? 0,
        low: data.stats?.low ?? 0,
        suggestion: data.stats?.suggestion ?? 0,
        praise: data.stats?.praise ?? 0,
      },
    }
  }

  private mapChangedFile(data: any): ReviewChangedFile {
    return {
      filename: data.filename || '',
      status: data.status || 'modified',
      additions: Number(data.additions) || 0,
      deletions: Number(data.deletions) || 0,
      changes: Number(data.changes) || 0,
      patch: typeof data.patch === 'string' ? data.patch : null,
    }
  }

  private mapArtifacts(data: any): ReviewJobArtifacts | undefined {
    if (!data?.changedFiles || !Array.isArray(data.changedFiles)) return undefined
    return {
      changedFiles: data.changedFiles.map((file: any) =>
        this.mapChangedFile(file),
      ),
    }
  }

  private mapReviewJobRecord(data: any): ReviewJobRecord {
    return {
      reviewId: data.reviewId,
      status: data.status as ReviewStatus,
      progress: this.mapReviewProgress(data.progress || {}),
      result: data.result ? this.mapReviewResult(data.result) : null,
      error: data.error || null,
      prUrl: data.prUrl || '',
      mode: data.mode === 'compare' ? 'compare' : 'pr',
      sourceLabel: data.sourceLabel || '',
      createPrUrl: data.createPrUrl || null,
      artifacts: this.mapArtifacts(data.artifacts),
      createdAt: data.createdAt || '',
      completedAt: data.completedAt || null,
    }
  }
}

export const codeReviewService = new CodeReviewService()
export default codeReviewService
