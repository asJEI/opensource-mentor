import type { PlatformEnv } from '../config'
import { ApiError, success } from '../http'
import { readSession } from './session'
import { readCurrentUser } from './userPersistence'
import { createSupabaseClient } from '../supabase/client'
import { validMentorProfile } from '../../shared/mentorProfile'

type Grant = { userId: string; githubId: number; connectionId: string; exp: number; kind: 'code' | 'profile'; challenge?: string }
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const decode = (s: string) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
async function key(env: PlatformEnv) {
  if (!env.SESSION_SECRET) throw new ApiError('Account connection is not configured', 503)
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function signGrant(env: PlatformEnv, value: Grant) {
  const body = encode(new TextEncoder().encode(JSON.stringify(value)))
  return body + '.' + encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(env), new TextEncoder().encode('mentor:' + body))))
}
export async function verifyGrant(env: PlatformEnv, token: string, kind: Grant['kind']): Promise<Grant> {
  try {
    const [body, signature, extra] = token.split('.')
    if (extra || !signature || !await crypto.subtle.verify('HMAC', await key(env), decode(signature), new TextEncoder().encode('mentor:' + body))) throw new Error()
    const p = JSON.parse(new TextDecoder().decode(decode(body))) as Grant
    if (p.kind !== kind || !Number.isFinite(p.exp) || p.exp <= Date.now() / 1000 || typeof p.userId !== 'string' || !Number.isSafeInteger(p.githubId) || typeof p.connectionId !== 'string') throw new Error()
    return p
  } catch { throw new ApiError('Agent connection expired or invalid; reconnect in the browser', 401) }
}
export function validateCallback(raw: string) {
  let u: URL
  try { u = new URL(raw) } catch { throw new ApiError('Invalid local callback', 400) }
  if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || Number(u.port) < 1024 || !u.port || u.pathname !== '/callback' || u.search || u.hash || u.username || u.password) throw new ApiError('Invalid local callback', 400)
  return u
}
export const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('JSON body required', 400)
  let text = '', size = 0
  const decoder = new TextDecoder()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 8192) { await reader.cancel(); throw new ApiError('Request too large', 413) }
    text += decoder.decode(value, { stream: true })
  }
  try { return JSON.parse(text + decoder.decode()) } catch { throw new ApiError('Invalid JSON', 400) }
}
export async function current(env: PlatformEnv, grant: Pick<Grant, 'userId' | 'githubId'>) {
  const user = await readCurrentUser(env, grant.githubId)
  if (!user || user.appUser.id !== grant.userId) throw new ApiError('Account unavailable', 401)
  return user
}
// Reuse the existing JSON column, preserving the generated GitHub ability profile.
export async function patch(env: PlatformEnv, user: Awaited<ReturnType<typeof current>>, data: Record<string, unknown>, extra = {}, pendingRequest?: string) {
  const row = user.developerProfile
  const relation = row.user_id ? 'user_id' : 'app_user_id'
  const previous = record(row.developer_profile).mentorConnectionId
  const condition = typeof previous === 'string' ? `&developer_profile->>mentorConnectionId=eq.${encodeURIComponent(previous)}` : '&developer_profile->>mentorConnectionId=is.null'
  const pendingCondition = pendingRequest ? `&developer_profile->>mentorPendingRequestId=eq.${encodeURIComponent(pendingRequest)}` : ''
  const rows = await createSupabaseClient(env).request<Array<{ developer_profile: unknown }>>(`/developer_profiles?${relation}=eq.${encodeURIComponent(user.appUser.id)}${condition}${pendingCondition}&select=developer_profile`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ developer_profile: data, ...extra }) })
  if (!rows.length) throw new ApiError('Profile was not saved', 502)
}
export const secureHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" }
export async function handleMentor(request: Request, env: PlatformEnv): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === '/api/mcp/connect') {
    const callback = validateCallback(url.searchParams.get('callback') || '')
    const challenge = url.searchParams.get('challenge') || ''
    const state = url.searchParams.get('state') || ''
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge) || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new ApiError('Invalid connection request', 400)
    const zh = url.searchParams.get('locale') === 'zh-CN'
    const session = await readSession(request, env)
    if (request.method === 'GET') {
      const title = zh ? '连接 OpenSource Mentor Agent' : 'Connect OpenSource Mentor Agent'
      const username = session ? (await current(env, session)).appUser.github_username.replace(/[<>&"']/g, '') : ''
      const body = session ? `<p>${zh ? '允许本机 Agent 读取和更新你的学习画像，有效期 7 天。重新连接会替换旧连接。不会授予 GitHub 写入权限，也不会传递模型 API Key。' : 'Allow the local Agent to read and update your learning profile for 7 days. A new connection replaces the previous one. No GitHub write permission or model API keys are shared.'}</p><form method="post"><button>${zh ? '同意连接' : 'Allow connection'}</button></form>` : `<p>${zh ? '先在新标签页登录 GitHub，再返回刷新本页并确认连接。' : 'Sign in with GitHub in a new tab, then return and refresh this page to approve.'}</p><a target="_blank" rel="noreferrer" href="/api/auth/github/start?locale=${zh ? 'zh-CN' : 'en-US'}">GitHub Login</a>`
      return new Response(`<!doctype html><html lang="${zh ? 'zh-CN' : 'en-US'}"><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:24px"><h1>${title}</h1><p>${username ? `GitHub: ${username}` : ''}</p>${body}<p>${zh ? '若你没有发起此连接，请关闭此页面。' : 'Close this page if you did not initiate this connection.'}</p></body></html>`, { headers: { ...secureHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
    }
    if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError('Confirm connection from this website', 403)
    if (!session) throw new ApiError('Sign in first', 401)
    const user = await current(env, session)
    const connectionId = crypto.randomUUID()
    await patch(env, user, { ...record(user.developerProfile.developer_profile), mentorConnectionId: connectionId })
    const code = await signGrant(env, { ...session, connectionId, kind: 'code', challenge, exp: Math.floor(Date.now() / 1000) + 120 })
    callback.searchParams.set('code', code); callback.searchParams.set('state', state)
    return new Response(null, { status: 303, headers: { ...secureHeaders, Location: callback.toString() } })
  }
  if (url.pathname === '/api/mcp/exchange' && request.method === 'POST') {
    const body = record(await readJson(request))
    if (typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.verifier)) throw new ApiError('Invalid verifier', 400)
    const grant = await verifyGrant(env, String(body.code), 'code')
    if (encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.verifier)))) !== grant.challenge) throw new ApiError('Invalid verifier', 401)
    const user = await current(env, grant)
    if (record(user.developerProfile.developer_profile).mentorConnectionId !== grant.connectionId) throw new ApiError('Connection revoked', 401)
    const exp = Math.floor(Date.now() / 1000) + 7 * 86400
    // Rotate at exchange: a captured authorization code cannot be redeemed twice.
    const connectionId = crypto.randomUUID()
    await patch(env, user, { ...record(user.developerProfile.developer_profile), mentorConnectionId: connectionId })
    return success({ token: await signGrant(env, { userId: grant.userId, githubId: grant.githubId, connectionId, exp, kind: 'profile' }), expiresAt: exp })
  }
  const grant = await verifyGrant(env, (request.headers.get('Authorization') || '').replace(/^Bearer /, ''), 'profile')
  const user = await current(env, grant)
  const data = record(user.developerProfile.developer_profile)
  if (data.mentorConnectionId !== grant.connectionId) throw new ApiError('Connection revoked; reconnect', 401)
  if (request.method === 'DELETE') {
    await patch(env, user, { ...data, mentorConnectionId: null })
    return success({ disconnected: true })
  }
  if (request.method === 'PUT') {
    const profile = await readJson(request)
    if (!validMentorProfile(profile)) throw new ApiError('Invalid user profile', 400)
    await patch(env, user, { ...data, mentorPreferences: profile }, { profile_setup_status: profile.profileSetupStatus, profile_confirmed: true, preferred_tech_stack: profile.programmingLanguages, contribution_time_budget: profile.weeklyHours < 1 ? 'lt_1h' : profile.weeklyHours < 3 ? '1_3h' : profile.weeklyHours <= 6 ? '3_6h' : 'weekend' })
    return success({ profile, username: user.appUser.github_username })
  }
  if (request.method !== 'GET') throw new ApiError('Method not allowed', 405)
  return success({ profile: validMentorProfile(data.mentorPreferences) ? data.mentorPreferences : null, username: user.appUser.github_username, githubEvidence: { languages: user.developerProfile.languages, level: user.developerProfile.developer_level }, expiresAt: grant.exp })
}
