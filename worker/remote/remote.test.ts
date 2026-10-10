import { describe, it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createRemoteHandler } from './index.mjs'
import { RemoteUserState } from './state.mjs'
import { hash } from './policy.mjs'

// Fake DO storage implements serialized transactions; the Worker and SDK remain real.
class MemoryStorage {
  values = new Map<string, unknown>()
  tail: Promise<unknown> = Promise.resolve()
  async get(key: string) { return structuredClone(this.values.get(key)) }
  async put(key: string, value: unknown) { this.values.set(key, structuredClone(value)) }
  transaction<T>(fn: (tx: MemoryStorage) => Promise<T>): Promise<T> {
    const next = this.tail.then(() => fn(this))
    this.tail = next.catch(() => {})
    return next
  }
}
const tokenA = 'a'.repeat(43), tokenB = 'b'.repeat(43)
const profile = (language: string) => ({ profileSetupStatus: 'completed', programmingLanguages: [language], experienceLevel: 'beginner', interests: ['frontend'], goals: ['first_contribution'], weeklyHours: 5, locale: 'en-US' })
async function fixture() {
  const upstream: Array<{ url: string; headers: Headers; body?: string }> = []
  const env: Record<string, any> = {
    REMOTE_ORIGIN: 'https://remote.example', WEBSITE_ORIGIN: 'https://web.example',
    PLATFORM_LLM_API_KEY: 'must-never-be-used',
    REMOTE_ACCESS_TOKENS: JSON.stringify({ [await hash(tokenA)]: { id: 'alice', scopes: ['profile', 'agent', 'byok'] }, [await hash(tokenB)]: { id: 'bob', scopes: ['profile', 'agent'] } }),
    REMOTE_RATE_LIMITER: { limit: async () => ({ success: true }) },
  }
  const objects = new Map<string, { object: RemoteUserState; storage: MemoryStorage }>()
  env.REMOTE_USERS = {
    idFromName: (id: string) => id,
    get(id: string) {
      if (!objects.has(id)) {
        const storage = new MemoryStorage()
        objects.set(id, { storage, object: new RemoteUserState({ storage }, env) })
      }
      return { fetch: (req: Request) => objects.get(id)!.object.fetch(req) }
    },
  }
  const handler = createRemoteHandler(async (url: URL, init: RequestInit) => {
    upstream.push({ url: String(url), headers: new Headers(init.headers), body: init.body as string })
    if (url.hostname === 'api.github.com') return Response.json({ full_name: 'a/b', html_url: 'https://github.com/a/b', default_branch: 'main' })
    return Response.json({ success: true, data: { fullName: 'a/b', answer: 'generated' } })
  })
  const request = async (method: string, args: object = {}, headers: Record<string, string> = {}) => handler(new Request('https://remote.example/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: args }) }), env)
  const call = (name: string, args: object = {}, token?: string, extra = {}) => request('tools/call', { name, arguments: args }, { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extra })
  return { env, objects, upstream, handler, request, call }
}
describe('Remote MCP MVP', () => {
  it('supports an actual SDK HTTP client, discovery and anonymous repository reads', async () => {
    const f = await fixture()
    const host = new Client({ name: 'http-test', version: '1' })
    const transport = new StreamableHTTPClientTransport(new URL('https://remote.example/mcp'), { fetch: (input: any, init?: RequestInit) => f.handler(new Request(input, init), f.env) })
    await host.connect(transport)
    try {
      expect((await host.listTools()).tools).toHaveLength(17)
      const result = await host.callTool({ name: 'get_repository', arguments: { owner: 'a', repo: 'b' } })
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual({ data: { fullName: 'a/b', answer: 'generated' } })
      expect(f.upstream[0].headers.has('Authorization')).toBe(false)
      expect(f.upstream[0].headers.has('X-AI-Key')).toBe(false)
    } finally { await host.close() }
  })
  it('rejects unauthenticated protected tools, invalid tokens and missing scopes before any upstream call', async () => {
    const f = await fixture()
    for (const name of ['get_user_profile', 'connect_account', 'mentor_chat', 'review_pull_request']) expect((await f.call(name, { modelSource: 'agent' })).status).toBe(401)
    expect((await f.call('get_repository', {}, 'z'.repeat(43))).status).toBe(401)
    expect((await f.call('mentor_chat', {}, tokenB)).status).toBe(403)
    expect(f.upstream).toHaveLength(0)
  })
  it('never uses a platform key; website generation needs per-request BYOK with fixed provider endpoints', async () => {
    const f = await fixture()
    const args = { owner: 'a', repo: 'b', message: 'help', modelSource: 'website' }
    expect((await f.call('mentor_chat', args, tokenA)).status).toBe(403)
    expect((await f.call('mentor_chat', args, tokenA, { 'X-AI-Key': 'user-secret', 'X-AI-Base-Url': 'http://127.0.0.1' })).status).toBe(400)
    expect((await f.call('mentor_chat', args, tokenA, { 'X-AI-Key': 'user-secret', 'X-AI-Provider': 'unknown' })).status).toBe(400)
    const response = await f.call('mentor_chat', args, tokenA, { 'X-AI-Key': 'user-secret', 'X-AI-Provider': 'deepseek' })
    expect(response.status).toBe(200)
    expect(f.upstream.at(-1)!.headers.get('X-AI-Key')).toBe('user-secret')
    expect(f.upstream.at(-1)!.headers.get('X-AI-Mode')).toBe('custom')
    expect(f.upstream.at(-1)!.headers.has('Cookie')).toBe(false)
    expect(await response.text()).not.toContain('user-secret')
    expect(JSON.stringify(f.upstream)).not.toContain('must-never-be-used')
    expect((await f.call('mentor_chat', args, tokenA)).status).toBe(403)
  })
  it('isolates concurrent profile writes and server credentials by principal instead of session ID', async () => {
    const f = await fixture()
    const writes = await Promise.all([f.call('save_user_profile', { profile: profile('typescript') }, tokenA), f.call('save_user_profile', { profile: profile('python') }, tokenB)])
    expect(writes.map(r => r.status)).toEqual([200, 200])
    const [a, b] = await Promise.all([f.call('get_user_profile', {}, tokenA), f.call('get_user_profile', {}, tokenB)])
    expect((await a.json() as any).result.structuredContent.data.profile.programmingLanguages).toEqual(['typescript'])
    expect((await b.json() as any).result.structuredContent.data.profile.programmingLanguages).toEqual(['python'])
    expect(f.objects.size).toBe(2)
    await f.call('disconnect_account', {}, tokenA)
    expect((await (await f.call('get_user_profile', {}, tokenB)).json() as any).result.structuredContent.data.profile.programmingLanguages).toEqual(['python'])
    expect((await f.request('tools/list', {}, { 'Mcp-Session-Id': 'stolen-session' })).status).toBe(400)
  })
  it('limits atomic concurrent calls and daily paid attempts without charging a global platform account', async () => {
    const f = await fixture()
    const stub = f.env.REMOTE_USERS.get('quota-test')
    const charge = (lease: string, website = true) => stub.fetch(new Request('https://internal/charge', { method: 'POST', body: JSON.stringify({ lease, website }) }))
    const outcomes = await Promise.all(['a', 'b', 'c'].map(async id => (await (await charge(id)).json() as any).allowed))
    expect(outcomes.filter(Boolean)).toHaveLength(2)
    const storage = f.objects.get('quota-test')!.storage
    await storage.put('quota', { day: '2000-01-01', total: 200, website: 20, leases: { active1: Date.now() + 60000, active2: Date.now() + 60000 } })
    expect((await (await charge('midnight')).json() as any).allowed).toBe(false)
    await storage.put('quota', { day: new Date().toISOString().slice(0, 10), total: 20, website: 20, leases: {} })
    expect((await (await charge('daily')).json() as any).allowed).toBe(false)
    await storage.put('quota', { day: new Date().toISOString().slice(0, 10), total: 200, website: 0, leases: {} })
    expect((await (await charge('total', false)).json() as any).allowed).toBe(false)
  })
  it('validates Origin, fails closed on missing rate limiter, and bounds request bodies and batches', async () => {
    const f = await fixture()
    expect((await f.request('tools/list', {}, { Origin: 'https://evil.example' })).status).toBe(403)
    const response = await f.request('tools/list', {}, { Origin: 'https://remote.example' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://remote.example')
    const oversized = new Request('https://remote.example/mcp', { method: 'POST', body: 'x'.repeat(129 * 1024) })
    expect((await f.handler(oversized, f.env)).status).toBe(413)
    expect((await f.handler(new Request('https://remote.example/mcp', { method: 'POST', body: '[]' }), f.env)).status).toBe(400)
    f.env.REMOTE_RATE_LIMITER = undefined
    expect((await f.request('tools/list')).status).toBe(503)
  })
})
