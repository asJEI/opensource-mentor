import { afterEach, describe, expect, it, vi } from 'vitest'
import catalog from './en-US.json'

function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function firstVisit(language: string) {
  vi.resetModules()
  vi.stubGlobal('navigator', { language })
  vi.stubGlobal('localStorage', storage())
  return (await import('@/store/user')).useUserStore
}

describe('browser language preference', () => {
  it.each([['zh-TW', 'zh-CN'], ['en-GB', 'en-US'], ['fr-FR', 'en-US']])(
    'first visit with %s uses %s', async (language, expected) => {
      const store = await firstVisit(language)
      expect(store.getState().preferences.language).toBe(expected)
    },
  )
  it('persists explicit selection through refresh, logout and restored sign-in', async () => {
    const store = await firstVisit('zh-CN')
    store.getState().updatePreferences({ language: 'en-US' })
    store.getState().logout()
    expect(store.getState().preferences.language).toBe('en-US')
    vi.resetModules()
    const restored = (await import('@/store/user')).useUserStore
    expect(restored.getState().preferences.language).toBe('en-US')
    restored.getState().applyServerUserState({
      serverUserId: 'test-user', githubProfile: null, githubUsername: 'test', githubAvatar: '',
      profileSetupStatus: 'completed', profileConfirmed: true,
      openSourceGoal: '', preferredTechStack: [], contributionTimeBudget: '', guidancePreference: '',
    })
    expect(restored.getState().preferences.language).toBe('en-US')
    const { createBffHeaders } = await import('@/services/request')
    expect(createBffHeaders()['Accept-Language']).toBe('en-US')
  })
  it('reads migrated language and falls back safely for an unsupported saved value', async () => {
    const store = await firstVisit('en-US')
    localStorage.setItem('opensource-mentor:user-profile', JSON.stringify({ version: 1,
      state: { preferences: { language: 'unsupported' } } }))
    await store.persist.rehydrate()
    expect(store.getState().preferences.language).toBe('en-US')
  })
  it('interpolates without translating technical values and has matching placeholders', async () => {
    await firstVisit('en-US')
    const { t, translate } = await import('./index')
    expect(t('已确认仓库：{0}', ['owner/中文仓库'])).toBe('Confirmed repository: owner/中文仓库')
    expect(translate('未知的原始 Issue', 'en-US')).toBe('未知的原始 Issue')
    expect(translate('复制', 'zh-CN')).toBe('复制')
    for (const [key, value] of Object.entries(catalog)) {
      const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((item) => item[0]).sort()
      expect(placeholders(value), key).toEqual(placeholders(key))
    }
  })
  it('updates already visible toast messages after switching languages', async () => {
    const store = await firstVisit('zh-CN')
    const { t, uiMessage } = await import('./index')
    const message = t('已确认仓库：{0}', ['owner/中文仓库'])
    store.getState().updatePreferences({ language: 'en-US' })
    const english = uiMessage(message)
    expect(english).toBe('Confirmed repository: owner/中文仓库')
    store.getState().updatePreferences({ language: 'zh-CN' })
    expect(uiMessage(english)).toBe(message)
    expect(uiMessage('Unrelated original Issue quotation')).toBe('Unrelated original Issue quotation')
  })
})
