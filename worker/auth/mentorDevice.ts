import type { PlatformEnv } from '../config'
import { ApiError, success } from '../http'
import { createSupabaseClient, type DeveloperProfileRow, type AppUserRow } from '../supabase/client'
import { readSession } from './session'
import { current, patch, readJson, record, secureHeaders, signGrant } from './mentor'

type DeviceRequest = { id: string; challenge: string; exp: number }
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
async function signingKey(env: PlatformEnv) {
  if (!env.SESSION_SECRET) throw new ApiError('Account connection is not configured', 503)
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
async function signRequest(env: PlatformEnv, request: DeviceRequest) {
  const body = encode(new TextEncoder().encode(JSON.stringify(request)))
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode('mentor-device:' + body))
  return body + '.' + encode(new Uint8Array(signature))
}
async function verifyRequest(env: PlatformEnv, value: unknown): Promise<DeviceRequest> {
  try {
    if (typeof value !== 'string' || value.length > 2048) throw new Error()
    const [body, signature, extra] = value.split('.')
    if (extra || !signature || !await crypto.subtle.verify('HMAC', await signingKey(env), decode(signature), new TextEncoder().encode('mentor-device:' + body))) throw new Error()
    const parsed = JSON.parse(new TextDecoder().decode(decode(body))) as DeviceRequest
    if (!/^[A-Za-z0-9_-]{43}$/.test(parsed.id) || !/^[A-Za-z0-9_-]{43}$/.test(parsed.challenge) || !Number.isFinite(parsed.exp)) throw new Error()
    if (parsed.exp <= Date.now() / 1000) throw new ApiError('Connection request expired; start again', 410)
    return parsed
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Invalid connection request', 400)
  }
}
const confirmationCode = (request: DeviceRequest) => request.id.slice(0, 8).toUpperCase()
function page(zh: boolean, body: string) {
  const title = zh ? '连接 OpenSource Mentor Agent' : 'Connect OpenSource Mentor Agent'
  return new Response(`<!doctype html><html lang="${zh ? 'zh-CN' : 'en-US'}"><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:24px"><h1>${title}</h1>${body}</body></html>`, { headers: { ...secureHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}
async function rateLimit(request: Request, env: PlatformEnv) {
  const result = await env.PLATFORM_AI_RATE_LIMITER?.limit({ key: 'mcp-device:' + (request.headers.get('CF-Connecting-IP') || 'local') })
  if (result && !result.success) throw new ApiError('Too many connection requests; wait before trying again', 429)
}
/** Browser approval followed by proof-bound polling; no browser-to-Agent network connection. */
export async function handleMentorDevice(request: Request, env: PlatformEnv): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === '/api/mcp/device/start' && request.method === 'POST') {
    await rateLimit(request, env)
    const body = record(await readJson(request))
    if (typeof body.challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.challenge)) throw new ApiError('Invalid connection challenge', 400)
    const value: DeviceRequest = { id: encode(crypto.getRandomValues(new Uint8Array(32))), challenge: body.challenge, exp: Math.floor(Date.now() / 1000) + 600 }
    const requestToken = await signRequest(env, value)
    const authorizationUrl = new URL('/api/mcp/connect', url.origin)
    authorizationUrl.searchParams.set('request', requestToken)
    authorizationUrl.searchParams.set('locale', body.locale === 'zh-CN' ? 'zh-CN' : 'en-US')
    return success({ requestToken, authorizationUrl: authorizationUrl.toString(), confirmationCode: confirmationCode(value), expiresAt: value.exp, interval: 5 })
  }
  if (url.pathname === '/api/mcp/connect') {
    const value = await verifyRequest(env, url.searchParams.get('request'))
    const zh = url.searchParams.get('locale') === 'zh-CN'
    const session = await readSession(request, env)
    if (request.method === 'GET') {
      const user = session ? await current(env, session) : null
      const username = user?.appUser.github_username.replace(/[<>&"']/g, '') || ''
      const body = user
        ? `<p>GitHub: ${username}</p><p>${zh ? '请核对 Agent 中显示的连接码：' : 'Verify this code matches the one shown by your Agent:'} <strong>${confirmationCode(value)}</strong></p><p>${zh ? '允许该 Agent 读取和更新学习画像，有效期 7 天。重新连接会替换旧连接，不授予 GitHub 写入权限，不共享模型 API Key。' : 'Allow this Agent to read and update your learning profile for 7 days. A new connection replaces the previous connection. No GitHub write permissions or model API keys are shared.'}</p><form method="post"><button name="decision" value="approve">${zh ? '同意连接' : 'Allow connection'}</button> <button name="decision" value="deny">${zh ? '拒绝' : 'Deny'}</button></form>`
        : `<p>${zh ? '先在新标签页登录 GitHub，然后返回刷新本页，核对连接码并确认。' : 'Sign in with GitHub in a new tab, then return and refresh this page to verify the code and approve.'}</p><a target="_blank" rel="noreferrer" href="/api/auth/github/start?locale=${zh ? 'zh-CN' : 'en-US'}">GitHub Login</a>`
      return page(zh, body + `<p>${zh ? '如果你没有发起这次连接，请关闭此页面。' : 'Close this page if you did not initiate this connection.'}</p>`)
    }
    if (request.method !== 'POST') throw new ApiError('Method not allowed', 405)
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError('Confirm connection from this website', 403)
    if (!session) throw new ApiError('Sign in first', 401)
    const decision = (await request.formData()).get('decision')
    if (decision !== 'approve' && decision !== 'deny') throw new ApiError('Choose whether to connect', 400)
    const user = await current(env, session)
    const data = record(user.developerProfile.developer_profile)
    const processed = await createSupabaseClient(env).request<DeveloperProfileRow[]>(`/developer_profiles?or=(developer_profile->>mentorPendingRequestId.eq.${value.id},developer_profile->>mentorConsumedRequestId.eq.${value.id})&select=id&limit=1`)
    if (processed.length) return page(zh, `<p>${zh ? '这次请求已处理，请返回 Agent 检查状态。' : 'This request was already processed. Return to your Agent to check its status.'}</p>`)
    await patch(env, user, {
      ...data,
      mentorPendingRequestId: value.id,
      mentorPendingDecision: decision,
      ...(decision === 'approve' ? { mentorConnectionId: crypto.randomUUID() } : {}),
    })
    return page(zh, `<p>${decision === 'approve' ? zh ? '已同意连接。返回 Agent，让它检查授权结果，无需复制任何凭证。' : 'Connection approved. Return to your Agent to check authorization. No credentials need to be copied.' : zh ? '已拒绝连接，未授予新的访问权限。' : 'Connection denied. No new access was granted.'}</p>`)
  }
  if (url.pathname !== '/api/mcp/device/poll' || request.method !== 'POST') throw new ApiError('Method not allowed', 405)
  await rateLimit(request, env)
  const body = record(await readJson(request))
  const value = await verifyRequest(env, body.requestToken)
  if (typeof body.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.verifier) || encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.verifier)))) !== value.challenge) throw new ApiError('Invalid connection proof', 401)
  const db = createSupabaseClient(env)
  const rows = await db.request<DeveloperProfileRow[]>(`/developer_profiles?developer_profile->>mentorPendingRequestId=eq.${value.id}&select=*&limit=2`)
  if (!rows.length) return success({ status: 'awaiting_browser' })
  if (rows.length !== 1) throw new ApiError('Connection request was approved by multiple accounts; start again', 409)
  const id = rows[0].user_id || rows[0].app_user_id
  if (!id) throw new ApiError('Account unavailable', 401)
  const users = await db.request<AppUserRow[]>(`/app_users?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
  if (!users.length) throw new ApiError('Account unavailable', 401)
  const user = await current(env, { userId: id, githubId: users[0].github_id })
  const data = record(user.developerProfile.developer_profile)
  if (data.mentorPendingRequestId !== value.id) return success({ status: 'awaiting_browser' })
  const connectionId = crypto.randomUUID()
  await patch(env, user, { ...data, mentorPendingRequestId: null, mentorPendingDecision: null, mentorConsumedRequestId: value.id, ...(data.mentorPendingDecision === 'approve' ? { mentorConnectionId: connectionId } : {}) }, {}, value.id)
  if (data.mentorPendingDecision !== 'approve') return success({ status: 'denied' })
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400
  const token = await signGrant(env, { userId: id, githubId: users[0].github_id, connectionId, kind: 'profile', exp: expiresAt })
  return success({ status: 'connected', token, expiresAt })
}
