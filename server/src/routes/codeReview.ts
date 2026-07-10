import { Router } from 'express'
import {
  createReview,
  getReview,
  healthCheck,
} from '../controllers/reviewController'

const router = Router()

// POST /code-review/reviews —— 创建代码审查任务
router.post('/reviews', createReview)

// GET /code-review/reviews/:id —— 获取审查状态和结果
router.get('/reviews/:id', getReview)

// GET /code-review/health —— 代码审查服务健康检查
router.get('/health', healthCheck)

export default router
