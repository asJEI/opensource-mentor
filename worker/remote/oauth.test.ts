import { describe, it, expect, vi } from 'vitest'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createRemoteHandler } from './index.mjs'
import { RemoteOAuthState, challenge } from './oauth.mjs'
import { RemoteUserState } from './state.mjs'
import { hash } from './policy.mjs'

class Storage {
  values = new Map<string, any>()
  async get(key: string) { return structuredClone(this.values.get(key)) }
  async put(key: string, value: any) { this.values.set(key, structuredClone(value)) }
  async delete(key: string) { return this.values.delete(key) }
  async setAlarm(_at: number) {}
  async list(options: any = {}) { return new Map([...this.values].sort().filter(([key]) => !options.startAfter || key > options.startAfter).slice(0, options.limit || 1000)) }
  async transaction(fn: (tx: Storage) => any) { return fn(this) }
}
const origin = 'https://remote.example', resource = origin + '/mcp'
const verifier = 'v'.repeat(43)
async function fixture() {
  const users = new Map<string, { storage: Storage; object: RemoteUserState }>()
  let approval = 'alice', count = 0
  const requests: Array<{ url: string; init: any }> = []
  const fetcher = async (input: URL, init: any = {}) => {
    const url = new URL(input)
    requests.push({ url: String(url), init })
    if (url.pathname === '/api/mcp/device/start') return Response.json({ success: true, data: { requestToken: 'request-' + ++count, authorizationUrl: 'https://web.example/api/mcp/connect?request=public', confirmationCode: 'AABBCCDD', expiresAt: Date.now() / 1000 + 600 } })
    const token = btoa(JSON.stringify({ userId: approval })) + '.verified-by-website'
    if (url.pathname === '/api/mcp/device/poll') return Response.json({ success: true, data: approval === 'pending' ? { status: 'awaiting_browser' } : approval === 'denied' ? { status: 'denied' } : { status: 'connected', token, expiresAt: Math.floor(Date.now() / 1000) + 604800 } })
    if (url.pathname === '/api/mcp/profile') {
      const user = JSON.parse(atob(init.headers.Authorization.slice(7).split('.')[0])).userId
      return Response.json({ success: true, data: { username: user, profile: null } })
    }
    return Response.json({ success: true, data: { fullName: 'a/b' } })
  }
  const env: any = { REMOTE_ORIGIN: origin, WEBSITE_ORIGIN: 'https://web.example', REMOTE_OAUTH_REQUIRE_LOGIN: 'true', REMOTE_RATE_LIMITER: { limit: async () => ({ success: true }) } }
  env.REMOTE_USERS = { idFromName: (id: string) => id, get(id: string) {
    if (!users.has(id)) { const storage = new Storage(); users.set(id, { storage, object: new RemoteUserState({ storage }, env, fetcher) }) }
    return { fetch: (r: Request) => users.get(id)!.object.fetch(r) }
  } }
  const storage = new Storage(), oauth = new RemoteOAuthState({ storage }, env, fetcher)
  env.REMOTE_OAUTH = { idFromName: (id: string) => id, get: () => ({ fetch: (r: Request) => oauth.fetch(r) }) }
  const handler = createRemoteHandler(fetcher)
  const fetchFn = (input: any, init?: RequestInit) => handler(new Request(input, init), env)
  const get = (path: string) => fetchFn(origin + path)
  const post = (path: string, data: any, extra: Record<string, string> = {}) => fetchFn(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(data) })
  const register = async () => (await (await post('/oauth/register', { client_name: '<Agent>', redirect_uris: ['http://127.0.0.1:4545/callback'], token_endpoint_auth_method: 'none' })).json() as any)
  const authorize = async (client_id: string, overrides: any = {}) => {
    const params = new URLSearchParams({ client_id, redirect_uri: 'http://127.0.0.1:4545/callback', response_type: 'code', resource, scope: 'profile agent', state: 'client-state', code_challenge: await challenge(verifier), code_challenge_method: 'S256', ...overrides })
    const response = await get('/oauth/authorize?' + params)
    const html = await response.text()
    const id = html.match(/\/oauth\/poll\?id=([A-Za-z0-9_-]+)/)?.[1]!
    const csrf = html.match(/'X-CSRF':'([A-Za-z0-9_-]+)'/)?.[1]!
    const cookie = response.headers.get('Set-Cookie')?.split(';')[0]!
    return { response, html, id, csrf, cookie }
  }
  const poll = (flow: any, headers = {}) => fetchFn(origin + '/oauth/poll?id=' + flow.id, { method: 'POST', headers: { Origin: origin, Cookie: flow.cookie, 'X-CSRF': flow.csrf, ...headers } })
  const code = async (client_id: string) => {
    const flow = await authorize(client_id), result = await (await poll(flow)).json() as any
    return new URL(result.redirect).searchParams.get('code')!
  }
  const exchange = (client_id: string, code: string, overrides = {}) => post('/oauth/token', { grant_type: 'authorization_code', client_id, code, code_verifier: verifier, redirect_uri: 'http://127.0.0.1:4545/callback', resource, ...overrides })
  return { env, storage, users, requests, oauth, fetchFn, get, post, register, authorize, poll, code, exchange, approve: (user: string) => { approval = user } }
}

describe('Remote OAuth authorization', () => {
  it('uses Cloudflare-compatible manual redirects without forwarding credentials to redirects', async () => {
    const f = await fixture()
    const native = vi.fn(async () => Response.json({ success: true, data: { requestToken: 'public-request', authorizationUrl: 'https://web.example/api/mcp/connect?request=public', confirmationCode: 'AABBCCDD' } }))
    vi.stubGlobal('fetch', native)
    try {
      const object = new RemoteOAuthState({ storage: new Storage() }, f.env)
      const response = await object.fetch(new Request('https://internal/start', { method: 'POST', body: JSON.stringify({ locale: 'en-US' }) }))
      expect(response.status).toBe(200)
      expect((native.mock.calls[0] as any)[1].redirect).toBe('manual')
      native.mockImplementation(async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }))
      const handler = createRemoteHandler()
      const denied = await handler(new Request(resource, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_repository', arguments: { owner: 'a', repo: 'b' } } }) }), f.env)
      expect((await denied.json() as any).result.isError).toBe(true)
      expect(native).toHaveBeenCalledTimes(2)
      expect((native.mock.calls[1] as any)[1].redirect).toBe('manual')
    } finally { vi.unstubAllGlobals() }
  })
  it('advertises resource metadata and challenges initial connection without manual credentials', async () => {
    const f = await fixture()
    const meta = await (await f.get('/.well-known/oauth-protected-resource/mcp')).json() as any
    expect(meta.resource).toBe(resource)
    const response = await f.post('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize' })
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain('resource_metadata=')
    expect((await f.get('/.well-known/oauth-authorization-server')).status).toBe(200)
    expect((await f.post('/oauth/register', { redirect_uris: ['http://evil.example/callback'] })).status).toBe(400)
    expect((await f.post('/oauth/register', { redirect_uris: ['https://user:pass@evil.example/callback'] })).status).toBe(400)
  })
  it('binds browser proof, exact redirect, PKCE, resource and one-time code; keeps website grant private', async () => {
    const f = await fixture(), client = await f.register()
    expect((await f.authorize(client.client_id, { redirect_uri: 'https://evil.example/callback' })).response.status).toBe(400)
    expect((await f.authorize(client.client_id, { resource: 'https://evil.example/mcp' })).response.status).toBe(400)
    const flow = await f.authorize(client.client_id)
    expect(flow.html).toContain('&lt;Agent&gt;')
    expect(flow.html).not.toContain('verified-by-website')
    expect((await f.poll(flow, { Origin: 'https://evil.example' })).status).toBe(403)
    expect((await f.poll(flow, { Cookie: '' })).status).toBe(403)
    expect((await f.poll(flow, { 'X-CSRF': 'wrong' })).status).toBe(403)
    const result = await (await f.poll(flow)).json() as any
    const redirect = new URL(result.redirect), code = redirect.searchParams.get('code')!
    expect(redirect.searchParams.get('state')).toBe('client-state')
    expect(JSON.stringify(result)).not.toContain('verified-by-website')
    expect((await f.exchange(client.client_id, code, { code_verifier: 'x'.repeat(43) })).status).toBe(400)
    expect((await f.exchange(client.client_id, code, { redirect_uri: 'http://127.0.0.1:4546/callback' })).status).toBe(400)
    expect((await f.exchange(client.client_id, code, { resource: 'https://evil.example/mcp' })).status).toBe(400)
    const response = await f.exchange(client.client_id, code), tokens = await response.json() as any
    expect(response.status).toBe(200)
    expect(tokens.expires_in).toBeLessThanOrEqual(3600)
    expect(JSON.stringify(tokens)).not.toContain('verified-by-website')
    expect((await f.exchange(client.client_id, code)).status).toBe(400)
    expect([...f.users.values()][0].storage.values.get('profile').token).toContain('verified-by-website')
  })
  it('rotates refresh tokens, detects reuse, revokes token families and enforces expiration', async () => {
    const f = await fixture(), client = await f.register()
    const tokens = await (await f.exchange(client.client_id, await f.code(client.client_id))).json() as any
    const refresh = (token: string) => f.post('/oauth/token', { grant_type: 'refresh_token', refresh_token: token, client_id: client.client_id, resource })
    const rotated = await (await refresh(tokens.refresh_token)).json() as any
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token)
    expect((await refresh(tokens.refresh_token)).status).toBe(400)
    const row = f.storage.values.get('access:' + await hash(rotated.access_token))
    expect(f.storage.values.get('grant:' + row.grantId).revoked).toBe(true)
    const second = await (await f.exchange(client.client_id, await f.code(client.client_id))).json() as any
    expect((await f.post('/oauth/revoke', { token: second.refresh_token, client_id: client.client_id })).status).toBe(200)
    expect((await refresh(second.refresh_token)).status).toBe(400)
    const third = await (await f.exchange(client.client_id, await f.code(client.client_id))).json() as any
    f.storage.values.get('access:' + await hash(third.access_token)).exp = 1
    const response = await f.post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Authorization: 'Bearer ' + third.access_token, Accept: 'application/json, text/event-stream' })
    expect(response.status).toBe(401)
  })
  it('isolates users, honors denial, limits admission and cleans expired private records', async () => {
    const f = await fixture(), client = await f.register()
    await f.exchange(client.client_id, await f.code(client.client_id))
    f.approve('bob')
    await f.exchange(client.client_id, await f.code(client.client_id))
    expect(f.users.size).toBe(2)
    expect(new Set([...f.users.values()].map(x => JSON.parse(atob(x.storage.values.get('profile').token.split('.')[0])).userId))).toEqual(new Set(['alice', 'bob']))
    f.approve('denied')
    const result = await (await f.poll(await f.authorize(client.client_id))).json() as any
    expect(new URL(result.redirect).searchParams.get('error')).toBe('access_denied')
    expect(new URL(result.redirect).searchParams.has('code')).toBe(false)
    await f.storage.put('admission', { day: new Date().toISOString().slice(0, 10), count: 1000 })
    expect((await f.post('/oauth/register', { redirect_uris: ['https://client.example/callback'] })).status).toBe(429)
    await f.storage.put('expired-record', { exp: 1, secret: 'expired' })
    await f.oauth.alarm()
    expect(await f.storage.get('expired-record')).toBeUndefined()
  })
  it('completes an actual SDK OAuth discovery/registration/PKCE exchange then connects and invokes a protected tool', async () => {
    const f = await fixture()
    let information: any, tokens: any, codeVerifier = '', authorization: URL | undefined
    const provider: any = {
      redirectUrl: 'http://127.0.0.1:4545/callback', clientMetadata: { client_name: 'SDK client', redirect_uris: ['http://127.0.0.1:4545/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] },
      clientInformation: () => information, saveClientInformation: (value: any) => { information = value },
      tokens: () => tokens, saveTokens: (value: any) => { tokens = value },
      saveCodeVerifier: (value: string) => { codeVerifier = value }, codeVerifier: () => codeVerifier,
      redirectToAuthorization: (value: URL) => { authorization = value }, state: () => 'sdk-state',
    }
    expect(await auth(provider, { serverUrl: resource, fetchFn: f.fetchFn, scope: 'profile agent' })).toBe('REDIRECT')
    const response = await f.fetchFn(authorization!), html = await response.text()
    const flow = { id: html.match(/\/oauth\/poll\?id=([A-Za-z0-9_-]+)/)?.[1], csrf: html.match(/'X-CSRF':'([A-Za-z0-9_-]+)'/)?.[1], cookie: response.headers.get('Set-Cookie')?.split(';')[0] }
    const result = await (await f.poll(flow)).json() as any
    expect(await auth(provider, { serverUrl: resource, authorizationCode: new URL(result.redirect).searchParams.get('code')!, fetchFn: f.fetchFn })).toBe('AUTHORIZED')
    const host = new Client({ name: 'oauth-test', version: '1' })
    await host.connect(new StreamableHTTPClientTransport(new URL(resource), { authProvider: provider, fetch: f.fetchFn }))
    try {
      expect((await host.listTools()).tools).toHaveLength(17)
      const result = await host.callTool({ name: 'get_user_profile', arguments: {} })
      expect(result.isError).not.toBe(true)
      expect((result.structuredContent as any).data.username).toBe('alice')
    } finally { await host.close() }
  })
})
