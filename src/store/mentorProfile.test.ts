import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it('restores confirmed Agent answers and locale without overriding in-progress web edits during generation polling', async () => {
  vi.resetModules()
  const values = new Map<string, string>()
  vi.stubGlobal('navigator', { language: 'zh-CN' })
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) })
  const store = (await import('./user')).useUserStore
  const profile = { profileSetupStatus: 'completed' as const, programmingLanguages: ['typescript' as const], experienceLevel: 'some_experience' as const, interests: ['testing' as const], goals: ['first_contribution' as const], weeklyHours: 4, locale: 'en-US' as const }
  const state = { serverUserId: 'u1', githubUsername: 'test', githubAvatar: '', githubProfile: null, profileSetupStatus: 'completed' as const, profileConfirmed: true, mentorProfile: profile, contributionTimeBudget: '3_6h' }
  store.getState().applyServerUserState(state)
  expect(store.getState().profile).toMatchObject({ programmingLanguages: ['typescript'], experienceLevel: 'some_experience', weeklyHours: 4 })
  expect(store.getState().preferences.language).toBe('en-US')
  store.getState().updateProfile({ programmingLanguages: ['python'] })
  store.getState().applyServerUserState(state, { mode: 'generation' })
  expect(store.getState().profile.programmingLanguages).toEqual(['python'])
  // A full login/refresh read restores the account's confirmed preferences.
  store.getState().applyServerUserState(state)
  expect(store.getState().profile.programmingLanguages).toEqual(['typescript'])
})
