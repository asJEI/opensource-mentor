import {
  ReviewJobRecord,
  ReviewProgress,
  ReviewResult,
  ReviewStatus,
} from '../types'
import { AppError } from '../utils/errors'
import { githubService } from './githubService'
import { aiService } from './aiService'
import { config } from '../config'

/**
 * PR Review 服务层
 *
 * 使用 GitHub API 获取 PR diff，然后调用 AI 服务进行代码审查
 * 支持异步审查模式：createReview 创建任务 -> getReview 轮询获取结果
 *
 * 设计思路：
 * - createReview 提交审查任务，返回 reviewId 和初始进度
 * - getReview 轮询获取审查状态和结果
 * - 审查过程分三个阶段：summary -> risk -> comments
 */
class PRReviewService {
  // 内存中的任务表（简易异步任务队列）
  private jobs = new Map<string, { record: ReviewJobRecord; createdAt: number; prInfo?: any }>()

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean }> {
    // 检查 GitHub API 是否可达
    try {
      await githubService.getRepository('microsoft', 'vscode')
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  /**
   * 创建审查任务
   * @param prUrl PR 链接
   * @param options 选项
   */
  async createReview(
    prUrl: string,
    options?: { forceMock?: boolean },
  ): Promise<{ reviewId: string; status: ReviewStatus; progress: ReviewProgress }> {
    const reviewId = this.generateId()
    const now = new Date().toISOString()

    const initialProgress: ReviewProgress = {
      percent: 0,
      phases: {
        summary: 'pending',
        risk: 'pending',
        comments: 'pending',
      },
      lastEventAt: now,
    }

    const record: ReviewJobRecord = {
      reviewId,
      status: 'queued',
      progress: initialProgress,
      result: null,
      error: null,
      prUrl,
      createdAt: now,
      completedAt: null,
    }

    this.jobs.set(reviewId, { record, createdAt: Date.now() })

    // 异步开始审查（不等待完成）
    this.startReviewAsync(reviewId, prUrl).catch((err) => {
      console.error('[PR-Review] 审查失败:', err.message)
      const job = this.jobs.get(reviewId)
      if (job) {
        job.record.status = 'failed'
        job.record.error = err.message || '审查失败'
      }
    })

    return {
      reviewId,
      status: 'queued',
      progress: initialProgress,
    }
  }

  /**
   * 获取审查状态和结果
   * @param reviewId 审查任务 ID
   */
  async getReview(reviewId: string): Promise<ReviewJobRecord> {
    const job = this.jobs.get(reviewId)

    if (!job) {
      throw new AppError('审查任务不存在', 404)
    }

    // 计算当前进度（基于已用时间模拟阶段推进，实际结果在异步任务中生成）
    this.updateProgress(job)

    return { ...job.record }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 异步执行审查
   */
  private async startReviewAsync(reviewId: string, prUrl: string): Promise<void> {
    const job = this.jobs.get(reviewId)
    if (!job) return

    try {
      // 阶段 1：解析 PR URL，获取 PR 信息
      job.record.status = 'running'
      job.record.progress.phases.summary = 'running'
      job.record.progress.percent = 15
      job.record.progress.lastEventAt = new Date().toISOString()

      const parsed = githubService.parsePrUrl(prUrl)
      if (!parsed) {
        throw new AppError('PR URL 格式不正确，请输入正确的 GitHub PR 链接', 400)
      }

      const { owner, repo, pullNumber } = parsed

      // 获取 PR 基本信息
      const prInfo = await githubService.getPullRequest(owner, repo, pullNumber)
      job.prInfo = prInfo

      // 获取 PR 文件列表
      const { files } = await githubService.getPullRequestFiles(owner, repo, pullNumber)

      // 获取 PR diff
      const diff = await githubService.getPullRequestDiff(owner, repo, pullNumber)

      // 阶段 2：风险分析
      job.record.progress.phases.summary = 'completed'
      job.record.progress.phases.risk = 'running'
      job.record.progress.percent = 50
      job.record.progress.lastEventAt = new Date().toISOString()

      // 等待一下模拟分析过程（让前端能看到进度变化）
      await this.delay(800)

      // 阶段 3：调用 AI 进行代码审查
      job.record.progress.phases.risk = 'completed'
      job.record.progress.phases.comments = 'running'
      job.record.progress.percent = 80
      job.record.progress.lastEventAt = new Date().toISOString()

      // 获取仓库信息（用于语言等上下文）
      let repoLanguage = 'TypeScript'
      try {
        const repoInfo = await githubService.getRepository(owner, repo)
        repoLanguage = repoInfo.language || 'TypeScript'
      } catch {
        // 忽略仓库信息获取失败
      }

      // 调用 AI 服务进行审查
      const result = await aiService.reviewPr({
        prUrl,
        prTitle: prInfo.title || '',
        prBody: prInfo.body || '',
        files: files.map((f: any) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch || '',
          raw_url: f.raw_url || '',
        })),
        diff,
        repoLanguage,
        repoFullName: `${owner}/${repo}`,
      })

      // 审查完成
      job.record.status = 'completed'
      job.record.progress.phases.comments = 'completed'
      job.record.progress.percent = 100
      job.record.progress.lastEventAt = new Date().toISOString()
      job.record.result = result as ReviewResult
      job.record.completedAt = new Date().toISOString()

      // 清理旧任务（保留最近 100 个）
      this.cleanupOldJobs()
    } catch (err) {
      console.error('[PR-Review] 审查失败:', err)
      job.record.status = 'failed'
      job.record.error = err instanceof Error ? err.message : '审查失败，请稍后重试'
      job.record.completedAt = new Date().toISOString()
    }
  }

  /**
   * 根据已用时间更新进度显示（平滑进度条）
   */
  private updateProgress(job: { record: ReviewJobRecord; createdAt: number }): void {
    if (job.record.status !== 'running') return

    const elapsed = Date.now() - job.createdAt
    const { progress } = job.record

    // 根据当前阶段和时间微调进度（让进度条看起来更平滑）
    if (progress.phases.summary === 'running') {
      progress.percent = Math.min(35, 10 + elapsed / 100)
    } else if (progress.phases.risk === 'running') {
      progress.percent = Math.min(65, 40 + elapsed / 200)
    } else if (progress.phases.comments === 'running') {
      progress.percent = Math.min(95, 70 + elapsed / 300)
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * 延时工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 清理过期任务
   */
  private cleanupOldJobs(): void {
    if (this.jobs.size > 100) {
      // 删除最早的任务（保留最近 50 个）
      const entries = Array.from(this.jobs.entries())
      entries.sort((a, b) => b[1].createdAt - a[1].createdAt)
      const toDelete = entries.slice(50)
      for (const [id] of toDelete) {
        this.jobs.delete(id)
      }
    }
  }
}

export const prReviewService = new PRReviewService()
export default prReviewService
