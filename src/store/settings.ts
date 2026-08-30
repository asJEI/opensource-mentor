import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AIProviderConfig, GitHubApiConfig } from '@/types'

const SETTINGS_STORAGE_KEY = 'opensource-mentor:api-settings'

export const DEFAULT_GITHUB_CONFIG: GitHubApiConfig = {
  mode: 'platform',
}

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  mode: 'platform',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
}

interface SettingsState {
  githubConfig: GitHubApiConfig
  aiConfig: AIProviderConfig
  updateGitHubConfig: (partial: Partial<GitHubApiConfig>) => void
  clearGitHubToken: () => void
  updateAIConfig: (partial: Partial<AIProviderConfig>) => void
  clearAIConfig: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeGitHubConfig(value: unknown): GitHubApiConfig {
  const data = isRecord(value) ? value : {}
  return {
    mode: data.mode === 'custom' ? 'custom' : 'platform',
    token:
      typeof data.token === 'string' && data.token.trim()
        ? data.token.trim()
        : undefined,
  }
}

function normalizeAIConfig(value: unknown): AIProviderConfig {
  const data = isRecord(value) ? value : {}
  const provider =
    data.provider === 'openai'
      ? 'openai'
      : data.provider === 'orcarouter'
        ? 'orcarouter'
        : data.provider === 'openai-compatible'
          ? 'openai-compatible'
          : 'deepseek'

  return {
    mode: data.mode === 'custom' ? 'custom' : 'platform',
    provider,
    baseUrl:
      typeof data.baseUrl === 'string' && data.baseUrl.trim()
        ? data.baseUrl.trim().replace(/\/+$/, '')
        : undefined,
    apiKey:
      typeof data.apiKey === 'string' && data.apiKey.trim()
        ? data.apiKey.trim()
        : undefined,
    model:
      typeof data.model === 'string' && data.model.trim()
        ? data.model.trim()
        : provider === 'deepseek'
          ? 'deepseek-v4-flash'
          : provider === 'openai'
            ? 'gpt-4o-mini'
            : provider === 'orcarouter'
              ? 'deepseek/deepseek-chat'
              : '',
  }
}

function withoutPersistedSecrets(config: GitHubApiConfig): GitHubApiConfig {
  return { mode: config.mode }
}

function withoutPersistedAIKey(config: AIProviderConfig): AIProviderConfig {
  const { apiKey: _apiKey, ...safeConfig } = config
  return safeConfig
}

/**
 * 仅持久化非敏感选项。PAT 和 AI API Key 只保留在当前页面内存中，
 * 刷新页面后需重新输入，避免长期明文留在 localStorage。
 */
const createMvpCredentialStorage = () =>
  createJSONStorage<Pick<SettingsState, 'githubConfig' | 'aiConfig'>>(
    () => localStorage,
  )

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], Pick<SettingsState, 'githubConfig' | 'aiConfig'>>(
    (set) => ({
      githubConfig: { ...DEFAULT_GITHUB_CONFIG },
      aiConfig: { ...DEFAULT_AI_CONFIG },

      updateGitHubConfig: (partial) =>
        set((state) => ({
          githubConfig: normalizeGitHubConfig({
            ...state.githubConfig,
            ...partial,
          }),
        })),

      clearGitHubToken: () =>
        set({ githubConfig: { ...DEFAULT_GITHUB_CONFIG } }),

      updateAIConfig: (partial) =>
        set((state) => ({
          aiConfig: normalizeAIConfig({
            ...state.aiConfig,
            ...partial,
          }),
        })),

      clearAIConfig: () =>
        set({ aiConfig: { ...DEFAULT_AI_CONFIG } }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 2,
      storage: createMvpCredentialStorage(),
      partialize: (state) => ({
        githubConfig: withoutPersistedSecrets(state.githubConfig),
        aiConfig: withoutPersistedAIKey(state.aiConfig),
      }),
      migrate: (persistedState) => {
        const data = isRecord(persistedState) ? persistedState : {}
        return {
          githubConfig: withoutPersistedSecrets(
            normalizeGitHubConfig(data.githubConfig),
          ),
          aiConfig: withoutPersistedAIKey(normalizeAIConfig(data.aiConfig)),
        }
      },
      merge: (persistedState, currentState) => {
        const data = isRecord(persistedState) ? persistedState : {}
        return {
          ...currentState,
          githubConfig: normalizeGitHubConfig(data.githubConfig),
          aiConfig: normalizeAIConfig(data.aiConfig),
        }
      },
    },
  ),
)

export default useSettingsStore
