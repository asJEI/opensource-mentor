import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleMentor, signGrant, verifyGrant, validateCallback } from './mentor'
import { readSession } from './session'
import { readCurrentUser } from './userPersistence'
import { createSupabaseClient } from '../supabase/client'
import type { PlatformEnv } from '../config'
vi.mock('./session', () => ({ readSession: vi.fn() }))
vi.mock('./userPersistence', () => ({ readCurrentUser: vi.fn() }))
vi.mock('../supabase/client', () => ({ createSupabaseClient: vi.fn() }))
const env = { SESSION_SECRET: 'test-only-signing-secret' } as PlatformEnv
const profile = { profileSetupStatus: 'completed', programmingLanguages: ['typescript'], experienceLevel: 'beginner', interests: ['frontend'], goals: ['first_contribution'], weeklyHours: 5, locale: 'zh-CN' }
let data: Record<string, unknown>
let writes: Array<{ path: string; body: Record<string, unknown> }>
beforeEach(() => {
  data = { level: 'beginner', mentorConnectionId: 'connection-a', mentorPreferences: profile }
  writes = []
  vi.mocked(readCurrentUser).mockImplementation(async () => ({ appUser: { id: 'u1', github_id: 42, github_username: 'test', github_avatar: '' }, developerProfile: { id: 'p1', user_id: 'u1', profile_setup_status: 'completed', profile_confirmed: true, developer_profile: { ...data } } }))
  vi.mocked(createSupabaseClient).mockReturnValue({ request: async (path: string, init: { body: string }) => {
    const body = JSON.parse(init.body)
    writes.push({ path, body }); data = body.developer_profile
    return [{ developer_profile: data }]
  } } as unknown as ReturnType<typeof createSupabaseClient>)
})
const token = () => signGrant(env, { userId: 'u1', githubId: 42, connectionId: 'connection-a', kind: 'profile', exp: Math.floor(Date.now() / 1000) + 300 })
describe('Agent profile authorization', () => {
  it('rejects remote callbacks and malformed local redirects', () => {
    expect(validateCallback('http://127.0.0.1:23456/callback').hostname).toBe('127.0.0.1')
    for (const url of ['https://evil.example/callback', 'http://localhost:23456/callback', 'http://127.0.0.1:80/callback', 'http://127.0.0.1:23456/callback?x=1', 'http://user@127.0.0.1:23456/callback']) expect(() => validateCallback(url)).toThrow()
  })
  it('rejects tampering, expiry and using an authorization code as a profile token', async () => {
    const value = await token()
    expect((await verifyGrant(env, value, 'profile')).userId).toBe('u1')
    await expect(verifyGrant(env, value + 'x', 'profile')).rejects.toThrow()
    await expect(verifyGrant(env, value, 'code')).rejects.toThrow()
    const expired = await signGrant(env, { userId: 'u1', githubId: 42, connectionId: 'connection-a', kind: 'profile', exp: 1 })
    await expect(verifyGrant(env, expired, 'profile')).rejects.toThrow()
  })
  it('requires a same-origin browser approval and logged-in account', async () => {
    const query = `callback=${encodeURIComponent('http://127.0.0.1:23456/callback')}&state=${'a'.repeat(43)}&challenge=${'b'.repeat(43)}`
    const url = `https://mentor.example/api/mcp/connect?${query}`
    vi.mocked(readSession).mockResolvedValue(null)
    const page = await handleMentor(new Request(url), env)
    expect(await page.text()).toContain('GitHub Login')
    await expect(handleMentor(new Request(url, { method: 'POST', headers: { Origin: 'https://evil.example' } }), env)).rejects.toThrow()
    await expect(handleMentor(new Request(url, { method: 'POST', headers: { Origin: 'https://mentor.example' } }), env)).rejects.toThrow('Sign in first')
    expect(writes).toHaveLength(0)
  })
  it('binds code exchange to a verifier, rotates its connection, and rejects replay', async () => {
    const verifier = 'x'.repeat(43)
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    const challenge = btoa(String.fromCharCode(...digest)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    const code = await signGrant(env, { userId: 'u1', githubId: 42, connectionId: 'connection-a', kind: 'code', challenge, exp: Math.floor(Date.now() / 1000) + 120 })
    const request = (v: string) => new Request('https://mentor.example/api/mcp/exchange', { method: 'POST', body: JSON.stringify({ code, verifier: v }) })
    await expect(handleMentor(request('z'.repeat(43)), env)).rejects.toThrow('Invalid verifier')
    const result = await (await handleMentor(request(verifier), env)).json() as { data: { token: string } }
    expect((await verifyGrant(env, result.data.token, 'profile')).connectionId).not.toBe('connection-a')
    expect(writes[0].path).toContain('mentorConnectionId=eq.connection-a')
    await expect(handleMentor(request(verifier), env)).rejects.toThrow('revoked')
  })
  it('preserves GitHub evidence, saves exact hours, and supports revocation', async () => {
    const value = await token()
    const request = (method: string, body?: unknown) => new Request('https://mentor.example/api/mcp/profile', { method, headers: { Authorization: `Bearer ${value}` }, ...(body ? { body: JSON.stringify(body) } : {}) })
    await handleMentor(request('PUT', profile), env)
    expect(data.level).toBe('beginner')
    expect(data.mentorPreferences).toEqual(profile)
    await expect(handleMentor(request('PUT', { ...profile, weeklyHours: 200 }), env)).rejects.toThrow('Invalid user profile')
    await handleMentor(request('DELETE'), env)
    await expect(handleMentor(request('GET'), env)).rejects.toThrow('revoked')
  })
})
