import { Router } from 'express'
import {
  explainIssue,
  analyzeRepository,
  recommendIssues,
  generatePrDraft,
  generateRoadmap,
  chat,
} from '../controllers/aiController'

const router = Router()

// POST /api/ai/explain —— 解释 Issue
router.post('/explain', explainIssue)

// POST /api/ai/analyze-repo —— AI 分析仓库
router.post('/analyze-repo', analyzeRepository)

// POST /api/ai/recommend-issues —— Issue 智能推荐
router.post('/recommend-issues', recommendIssues)

// POST /api/ai/generate-pr —— 生成 PR 草稿
router.post('/generate-pr', generatePrDraft)

// POST /api/ai/generate-roadmap —— 生成学习路线图
router.post('/generate-roadmap', generateRoadmap)

// POST /api/ai/chat —— AI 导师对话
router.post('/chat', chat)

export default router
