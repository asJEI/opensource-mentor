import { describe, expect, it, vi } from 'vitest'
import { updateDeveloperProfile } from './userPersistence'
import { createSupabaseClient } from '../supabase/client'
import type { PlatformEnv } from '../config'
vi.mock('../supabase/client', () => ({ createSupabaseClient: vi.fn() }))
describe('profile writes preserve connection revocation', () => {
  it('does not restore a stale connection when preferences were prepared before reconnecting', async () => {
    const row = { id: 'p', user_id: 'u', profile_setup_status: 'completed', profile_confirmed: true, developer_profile: { level: 'advanced', mentorConnectionId: 'new-connection' } }
    const calls: Array<{ path: string; body: Record<string, unknown> }> = []
    vi.mocked(createSupabaseClient).mockReturnValue({ request: async (path: string, init?: { body: string }) => {
      if (!init) return [row]
      const body = JSON.parse(init.body)
      calls.push({ path, body })
      return [{ ...row, ...body }]
    } } as unknown as ReturnType<typeof createSupabaseClient>)
    await updateDeveloperProfile({} as PlatformEnv, 'u', { developer_profile: { mentorConnectionId: 'old-connection', mentorPreferences: { weeklyHours: 5 } } })
    expect(calls[0].body.developer_profile).toEqual({ level: 'advanced', mentorConnectionId: 'new-connection', mentorPreferences: { weeklyHours: 5 } })
    expect(calls[0].path).toContain('mentorConnectionId=eq.new-connection')
  })
  it('reports a concurrent connection change instead of claiming a successful save', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue({ request: async (_path: string, init?: unknown) => init ? [] : [{ id: 'p', user_id: 'u', developer_profile: { mentorConnectionId: 'old' } }] } as unknown as ReturnType<typeof createSupabaseClient>)
    await expect(updateDeveloperProfile({} as PlatformEnv, 'u', { developer_profile: { mentorPreferences: {} } })).rejects.toThrow('Profile changed')
  })
})
