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

/**
 * MVP 凭据存储适配器。
 * 当前按产品约束使用 localStorage；未来可在此替换为系统密钥链或加密存储，
 * 无需修改业务页面和 API service。
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
      version: 1,
      storage: createMvpCredentialStorage(),
      partialize: (state) => ({
        githubConfig: state.githubConfig,
        aiConfig: state.aiConfig,
      }),
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
