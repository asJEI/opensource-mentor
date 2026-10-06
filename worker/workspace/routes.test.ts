import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGetWorkspace, handleSaveWorkspace } from './routes'
import { readSession } from '../auth/session'
import { readCurrentUser } from '../auth/userPersistence'
import { createSupabaseClient } from '../supabase/client'
import type { PlatformEnv } from '../config'

vi.mock('../auth/session', () => ({ readSession: vi.fn() }))
vi.mock('../auth/userPersistence', () => ({ readCurrentUser: vi.fn() }))
vi.mock('../supabase/client', () => ({ createSupabaseClient: vi.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const env = {} as PlatformEnv
const query = vi.fn()
const content = {
  prType: 'bug',
  summary: 'work',
  linkedIssue: '1',
  prDraft: null,
  currentOwner: 'owner',
  currentRepo: 'repo',
}
const input = {
  scope: 'owner/repo#1',
  kind: 'pr',
  content,
  expectedRevision: 0,
  operationId: '10000000-0000-4000-8000-000000000001',
}
const request = (body: unknown, origin = 'https://mentor.test') =>
  new Request('https://mentor.test/api/workspace', {
    method: 'PUT',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
describe('workspace identity and API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readSession).mockResolvedValue({ userId: id, githubId: 12, exp: 9999999999 })
    vi.mocked(readCurrentUser).mockResolvedValue({
      appUser: { id, github_id: 12, github_username: 'test', github_avatar: '' },
      developerProfile: {
        id: 'profile',
        profile_setup_status: 'completed',
        profile_confirmed: true,
      },
    })
    vi.mocked(createSupabaseClient).mockReturnValue({ request: query } as unknown as ReturnType<
      typeof createSupabaseClient
    >)
  })
  it('does not query persistence for unauthenticated requests', async () => {
    vi.mocked(readSession).mockResolvedValue(null)
    await expect(
      handleGetWorkspace(new Request('https://mentor.test/api/workspace'), env),
    ).rejects.toMatchObject({ status: 401 })
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects cross-site writes', async () => {
    await expect(
      handleSaveWorkspace(request(input, 'https://attacker.test'), env),
    ).rejects.toMatchObject({ status: 403 })
    expect(query).not.toHaveBeenCalled()
  })
  it('refuses forged user fields and credentials in persisted content', async () => {
    await expect(
      handleSaveWorkspace(request({ ...input, user_id: 'victim' }), env),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      handleSaveWorkspace(request({ ...input, content: { ...content, apiKey: 'private' } }), env),
    ).rejects.toMatchObject({ status: 400 })
    expect(query).not.toHaveBeenCalled()
  })
  it('passes only the server-verified owner to the atomic write RPC', async () => {
    query.mockResolvedValue({ status: 'saved', document: { kind: 'pr', content, revision: 1 } })
    const response = await handleSaveWorkspace(request(input), env)
    expect(response.status).toBe(200)
    const rpc = JSON.parse(query.mock.calls[0][1].body)
    expect(rpc.p_user_id).toBe(id)
    expect(rpc.p_scope).toBe(input.scope)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('returns a distinct version conflict with its server content', async () => {
    query.mockResolvedValue({ status: 'conflict', document: { kind: 'pr', content, revision: 3 } })
    const response = await handleSaveWorkspace(request(input), env)
    expect(response.status).toBe(409)
    expect(
      ((await response.json()) as { data: { document: { revision: number } } }).data.document
        .revision,
    ).toBe(3)
  })
  it('scopes both context and document reads to the authenticated owner', async () => {
    query.mockResolvedValueOnce([{ id: 'context' }]).mockResolvedValueOnce([])
    await handleGetWorkspace(
      new Request('https://mentor.test/api/workspace?scope=owner%2Frepo%231'),
      env,
    )
    expect(query.mock.calls.every(([path]) => path.includes(`user_id=eq.${id}`))).toBe(true)
  })
})
