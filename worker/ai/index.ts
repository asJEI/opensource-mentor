/**
 * Worker AI module barrel — provider / client / features / prompts.
 */

export { createAIClient, type AIClient, type AIClientConfig, type AIConfig } from './client'
export {
  PROVIDER_DEFAULT_BASE_URL,
  PROVIDER_DEFAULT_MODEL,
  resolveChatCompletionsUrl,
  resolveProviderBaseUrl,
  type AIProvider,
} from './providers'
export { resolveAIClient } from './resolveConfig'
export {
  handleAnalyzeRepo,
  handleChat,
  handleExplainIssue,
  handleGeneratePr,
  handleGenerateRoadmap,
  handleGenerateRoadmapPhase,
  handlePrepareRoadmapContext,
  handleRecommendIssues,
  handleTestAIConnection,
} from './routes'
