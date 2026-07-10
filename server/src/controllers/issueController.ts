import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { githubService } from '../services'
import { success } from '../utils/response'

/**
 * 获取 Issue 列表参数校验
 */
const getIssuesSchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  labels: z.string().optional(),
  sort: z.enum(['created', 'updated', 'comments']).optional().default('created'),
  direction: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
})

/**
 * Issue Controller
 */
export const issueController = {
  /**
   * GET /api/issues
   * 获取 Issue 列表
   */
  async getIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getIssuesSchema.parse(req.query)

      const result = await githubService.getIssues(query.owner, query.repo, {
        state: query.state,
        labels: query.labels,
        sort: query.sort,
        direction: query.direction,
        page: query.page,
        perPage: query.perPage,
      })

      res.json(
        success({
          items: result.items,
          total: result.total,
          page: query.page,
          perPage: query.perPage,
        }),
      )
    } catch (err) {
      next(err)
    }
  },
}

export default issueController
