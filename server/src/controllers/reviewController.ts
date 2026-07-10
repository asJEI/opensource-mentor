import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prReviewService } from '../services/prReviewService'
import { success } from '../utils/response'

// ============================================================
// 参数校验 Schema
// ============================================================

const createReviewSchema = z.object({
  prUrl: z.string().url('prUrl 必须是有效的 URL'),
  forceMock: z.boolean().optional(),
})

const getReviewSchema = z.object({
  id: z.string().min(1, '审查任务 ID 不能为空'),
})

// ============================================================
// Controller 方法
// ============================================================

/**
 * POST /code-review/reviews
 * 创建代码审查任务
 */
export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { prUrl, forceMock } = createReviewSchema.parse(req.body)

    const result = await prReviewService.createReview(prUrl, { forceMock })

    res.json(success(result, '审查任务已创建'))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /code-review/reviews/:id
 * 获取审查状态和结果
 */
export const getReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = getReviewSchema.parse(req.params)

    const result = await prReviewService.getReview(id)

    res.json(success(result))
  } catch (err) {
    next(err)
  }
}

/**
 * GET /code-review/health
 * 代码审查服务健康检查
 */
export const healthCheck = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await prReviewService.healthCheck()

    res.json(success(result))
  } catch (err) {
    next(err)
  }
}
