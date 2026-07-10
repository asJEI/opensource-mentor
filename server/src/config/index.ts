import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  github: {
    baseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
    token: process.env.GITHUB_TOKEN || '',
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',
    baseUrl: process.env.LLM_API_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    timeout: Number(process.env.LLM_TIMEOUT) || 60000,
  },
  prReview: {
    baseUrl: process.env.PR_REVIEW_BASE_URL || 'http://localhost:8787',
  },
}

export type AppConfig = typeof config
