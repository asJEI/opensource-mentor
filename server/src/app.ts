import express from 'express'
import cors from 'cors'
import { config } from './config'
import routes from './routes'
import {
  aiRequestContext,
  errorHandler,
  githubRequestContext,
  notFoundHandler,
  requestLogger,
} from './middlewares'

const app = express()

// 中间件
app.use(cors())
app.use(express.json())
app.use(requestLogger)
app.use(githubRequestContext)
app.use(aiRequestContext)

// 路由
app.use('/api', routes)

// 404
app.use(notFoundHandler)

// 全局错误处理（必须放在最后）
app.use(errorHandler)

// 启动服务
app.listen(config.port, () => {
  console.log('')
  console.log('🚀 OpenSource Mentor Server')
  console.log(`📍 Environment: ${config.nodeEnv}`)
  console.log(`🌐 Server: http://localhost:${config.port}`)
  console.log(`📡 API Base: http://localhost:${config.port}/api`)
  console.log('')
  console.log('Available endpoints:')
  console.log('  GET  /api/health                - 健康检查')
  console.log('  GET  /api/repository            - 仓库信息')
  console.log('  GET  /api/issues                - Issue 列表')
  console.log('  POST /api/ai/explain            - AI 解释 Issue')
  console.log('  POST /api/ai/analyze-repo       - AI 仓库分析')
  console.log('  POST /api/ai/recommend-issues   - AI Issue 推荐')
  console.log('  POST /api/ai/generate-pr        - AI 生成 PR 草稿')
  console.log('  POST /api/ai/generate-roadmap   - AI 生成学习路线图')
  console.log('  POST /api/ai/chat               - AI 导师对话')
  console.log('')
  console.log(`GitHub API: ${config.github.token ? '✅ Token 已配置' : '⚠️  未配置 Token（限流严重）'}`)
  console.log(`LLM API:    ${config.llm.apiKey ? `✅ ${config.llm.provider} / ${config.llm.model}` : '⚠️  未配置 Key（使用 Mock）'}`)
  console.log('')
})

export default app
