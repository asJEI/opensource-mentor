import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { handleMentorDevice } from './mentorDevice'
import { verifyGrant } from './mentor'
import { readSession } from './session'
import { readCurrentUser } from './userPersistence'
import { createSupabaseClient } from '../supabase/client'
import type { PlatformEnv } from '../config'
vi.mock('./session', () => ({ readSession: vi.fn() }))
vi.mock('./userPersistence', () => ({ readCurrentUser: vi.fn() }))
vi.mock('../supabase/client', () => ({ createSupabaseClient: vi.fn() }))
const env = { SESSION_SECRET: 'device-test-secret' } as PlatformEnv
let data: Record<string, unknown>
let writes: string[]
beforeEach(() => {
  data = { level: 'advanced', mentorConnectionId: 'existing-connection' }
  writes = []
  vi.mocked(readSession).mockResolvedValue({ userId: 'u1', githubId: 42, exp: 9999999999 })
  vi.mocked(readCurrentUser).mockImplementation(async () => ({ appUser: { id: 'u1', github_id: 42, github_username: 'test', github_avatar: '' }, developerProfile: { id: 'p1', user_id: 'u1', profile_setup_status: 'completed', profile_confirmed: true, developer_profile: { ...data } } }))
  vi.mocked(createSupabaseClient).mockReturnValue({ request: async (path: string, init?: { body: string }) => {
    if (init) { writes.push(path); data = JSON.parse(init.body).developer_profile; return [{ developer_profile: data }] }
    if (path.startsWith('/app_users')) return [{ id: 'u1', github_id: 42 }]
    if (path.includes('or=(')) return data.mentorPendingRequestId || data.mentorConsumedRequestId ? [{ id: 'p1' }] : []
    return data.mentorPendingRequestId && path.includes(String(data.mentorPendingRequestId)) ? [{ id: 'p1', user_id: 'u1', developer_profile: data }] : []
  } } as unknown as ReturnType<typeof createSupabaseClient>)
})
afterEach(() => vi.useRealTimers())
async function start() {
  const verifier = 'x'.repeat(43)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const challenge = btoa(String.fromCharCode(...digest)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  const r = await handleMentorDevice(new Request('https://mentor.example/api/mcp/device/start', { method: 'POST', body: JSON.stringify({ challenge, locale: 'zh-CN' }) }), env)
  const result = await r.json() as { data: { authorizationUrl: string; requestToken: string; expiresAt: number; confirmationCode: string } }
  return { ...result.data, verifier }
}
const poll = (s: Awaited<ReturnType<typeof start>>, verifier = s.verifier) => handleMentorDevice(new Request('https://mentor.example/api/mcp/device/poll', { method: 'POST', body: JSON.stringify({ requestToken: s.requestToken, verifier }) }), env)
const approve = (s: Awaited<ReturnType<typeof start>>, decision = 'approve', origin = 'https://mentor.example') => handleMentorDevice(new Request(s.authorizationUrl, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision }) }), env)
describe('cloud Agent browser authorization', () => {
  it('creates no database records before approval and has no localhost callback', async () => {
    const s = await start()
    expect(new URL(s.authorizationUrl).searchParams.has('callback')).toBe(false)
    expect(s.authorizationUrl).not.toContain(s.verifier)
    expect(writes).toHaveLength(0)
    expect(await (await poll(s)).json()).toMatchObject({ data: { status: 'awaiting_browser' } })
    const page = await handleMentorDevice(new Request(s.authorizationUrl), env)
    expect(await page.text()).toContain(s.confirmationCode)
  })
  it('requires browser login and same-origin explicit approval', async () => {
    const s = await start()
    await expect(approve(s, 'approve', 'https://evil.example')).rejects.toThrow('Confirm connection')
    vi.mocked(readSession).mockResolvedValue(null)
    expect(await (await handleMentorDevice(new Request(s.authorizationUrl), env)).text()).toContain('GitHub Login')
    await expect(approve(s)).rejects.toThrow('Sign in first')
    expect(writes).toHaveLength(0)
  })
  it('binds approval to the original Agent proof and consumes it once', async () => {
    const s = await start()
    await approve(s)
    await expect(poll(s, 'y'.repeat(43))).rejects.toThrow('Invalid connection proof')
    const response = await (await poll(s)).json() as { data: { status: string; token: string } }
    expect(response.data.status).toBe('connected')
    expect((await verifyGrant(env, response.data.token, 'profile')).githubId).toBe(42)
    expect(data.level).toBe('advanced')
    expect(data.mentorPendingRequestId).toBeNull()
    expect(writes.at(-1)).toContain('mentorPendingRequestId=eq.')
    expect(await (await poll(s)).json()).toMatchObject({ data: { status: 'awaiting_browser' } })
    const count = writes.length
    await approve(s)
    expect(writes).toHaveLength(count)
  })
  it('denies without revoking the existing connection or issuing a credential', async () => {
    const s = await start()
    await approve(s, 'deny')
    expect(await (await poll(s)).json()).toMatchObject({ data: { status: 'denied' } })
    expect(data.mentorConnectionId).toBe('existing-connection')
  })
  it('rejects expired and tampered requests', async () => {
    const s = await start()
    const tampered = new URL(s.authorizationUrl)
    tampered.searchParams.set('request', s.requestToken + 'x')
    await expect(handleMentorDevice(new Request(tampered), env)).rejects.toThrow('Invalid connection request')
    vi.useFakeTimers()
    vi.setSystemTime(new Date((s.expiresAt + 1) * 1000))
    await expect(poll(s)).rejects.toThrow('expired')
  })
})
