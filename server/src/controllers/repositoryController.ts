import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { githubService } from '../services'
import { success } from '../utils/response'

/**
 * 获取仓库信息参数校验
 */
const getRepositorySchema = z.object({
  owner: z.string().min(1, 'owner 不能为空'),
  repo: z.string().min(1, 'repo 不能为空'),
})

/**
 * 仓库 Controller
 */
export const repositoryController = {
  /**
   * GET /api/repository
   * 获取仓库基础信息
   */
  async getRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getRepositorySchema.parse(req.query)

      const repository = await githubService.getRepository(query.owner, query.repo)

      res.json(success(repository))
    } catch (err) {
      next(err)
    }
  },
}

export default repositoryController
