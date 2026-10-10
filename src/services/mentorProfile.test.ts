import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService, toServerUserState } from './authService'
import { bffPatch } from './request'
import { useUserStore } from '../store/user'
import type { ServerMeResponse } from './authService'
vi.mock('./request', () => ({ bffPatch: vi.fn().mockResolvedValue({}), bffGet: vi.fn(), bffPost: vi.fn() }))
vi.mock('../store/user', () => ({ useUserStore: { getState: vi.fn() } }))
const profile = { profileSetupStatus: 'completed' as const, programmingLanguages: ['typescript' as const], experienceLevel: 'beginner' as const, interests: ['frontend' as const], goals: ['first_contribution' as const], weeklyHours: 4, contributionTimeBudget: '3_6h' }
beforeEach(() => {
  vi.mocked(useUserStore.getState).mockReturnValue({ profile, preferences: { language: 'zh-CN' } } as unknown as ReturnType<typeof useUserStore.getState>)
  vi.mocked(bffPatch).mockClear()
})
describe('web and Agent profile interoperability', () => {
  it('preserves exact Agent hours when saving unrelated web preferences', async () => {
    await authService.updateDeveloperProfile({ guidancePreference: 'step_by_step' })
    expect(vi.mocked(bffPatch).mock.calls[0][1]).toMatchObject({ mentorProfile: { weeklyHours: 4, programmingLanguages: ['typescript'], locale: 'zh-CN' } })
  })
  it('saves edited answers rather than stale store values', async () => {
    await authService.updateDeveloperProfile({ contributionTimeBudget: '1_3h', profileContext: { ...profile, programmingLanguages: ['python'], goals: ['improve_engineering'] } })
    expect(vi.mocked(bffPatch).mock.calls[0][1]).toMatchObject({ mentorProfile: { programmingLanguages: ['python'], goals: ['improve_engineering'], weeklyHours: 2 } })
    expect(vi.mocked(bffPatch).mock.calls[0][1]).not.toHaveProperty('profileContext')
  })
  it('includes the account profile in web session hydration', () => {
    const me = { user: { id: 'u', githubUsername: 'test', githubAvatar: '' }, developerProfile: { profile_setup_status: 'completed', profile_confirmed: true }, mentorProfile: { ...profile, locale: 'en-US' } } as unknown as ServerMeResponse
    expect(toServerUserState(me).mentorProfile).toEqual(me.mentorProfile)
  })
})
