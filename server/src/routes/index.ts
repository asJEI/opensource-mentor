import { Router } from 'express'
import repositoryRoutes from './repository'
import issuesRoutes from './issues'
import aiRoutes from './ai.routes'
import codeReviewRoutes from './codeReview'
import { success } from '../utils/response'

const router = Router()

// 健康检查
router.get('/health', (_req, res) => {
  res.json(success({ status: 'ok', timestamp: new Date().toISOString() }))
})

// 业务路由
router.use('/repository', repositoryRoutes)
router.use('/issues', issuesRoutes)
router.use('/ai', aiRoutes)
router.use('/code-review', codeReviewRoutes)

export default router
