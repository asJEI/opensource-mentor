import { Router } from 'express'
import { repositoryController } from '../controllers'

const router = Router()

// GET /api/repository?owner=xxx&repo=xxx
router.get('/', repositoryController.getRepository)

export default router
