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
} from '@/types'

// ============================================================
// 代码审查服务（通过 BFF 调用）
// ============================================================

class CodeReviewService {
  /**
   * 创建审查任务
   * POST /api/code-review/reviews
   */
  async createReview(prUrl: string): Promise<{
    reviewId: string
    status: ReviewStatus
    progress: ReviewProgress
  }> {
    const data = await bffPost<any>('/code-review/reviews', { prUrl })
    return {
      reviewId: data.reviewId,
      status: data.status as ReviewStatus,
      progress: this.mapReviewProgress(data.progress),
    }
  }

  /**
   * 获取审查状态和结果
   * GET /api/code-review/reviews/:id
   */
  async getReview(reviewId: string): Promise<ReviewJobRecord> {
    const data = await bffGet<any>(`/code-review/reviews/${reviewId}`)
    return this.mapReviewJobRecord(data)
  }

  /**
   * 健康检查
   * GET /api/code-review/health
   */
  async healthCheck(): Promise<{ ok: boolean }> {
    const data = await bffGet<any>('/code-review/health')
    return {
      ok: data.ok ?? false,
    }
  }

  // ============================================================
  // DTO 映射（后端数据 -> 前端类型）
  // ============================================================

  private mapReviewProgress(data: any): ReviewProgress {
    return {
      percent: data.percent ?? 0,
      phases: {
        summary: (data.phases?.summary as ReviewProgress['phases']['summary']) || 'pending',
        risk: (data.phases?.risk as ReviewProgress['phases']['risk']) || 'pending',
        comments: (data.phases?.comments as ReviewProgress['phases']['comments']) || 'pending',
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

  private mapReviewJobRecord(data: any): ReviewJobRecord {
    return {
      reviewId: data.reviewId,
      status: data.status as ReviewStatus,
      progress: this.mapReviewProgress(data.progress || {}),
      result: data.result ? this.mapReviewResult(data.result) : null,
      error: data.error || null,
      prUrl: data.prUrl || '',
      createdAt: data.createdAt || '',
      completedAt: data.completedAt || null,
    }
  }
}

export const codeReviewService = new CodeReviewService()
export default codeReviewService
