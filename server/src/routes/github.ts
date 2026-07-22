import { Router } from 'express'
import { testGitHubConnection } from '../controllers/githubController'

const router = Router()

router.post('/test-connection', testGitHubConnection)

export default router
