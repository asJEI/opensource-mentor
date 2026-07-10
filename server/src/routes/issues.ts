import { Router } from 'express'
import { issueController } from '../controllers'

const router = Router()

// GET /api/issues?owner=xxx&repo=xxx
router.get('/', issueController.getIssues)

export default router
