export type ApiConfigMode = 'platform' | 'custom'

export interface GitHubApiConfig {
  mode: ApiConfigMode
  token?: string
}

export type AIProvider = 'deepseek' | 'openai-compatible'

export interface AIProviderConfig {
  mode: ApiConfigMode
  provider: AIProvider
  baseUrl?: string
  apiKey?: string
  model: string
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  account?: string
  model?: string
  latencyMs?: number
}
