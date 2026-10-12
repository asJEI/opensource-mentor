import { hash, RemoteError } from './policy.mjs';
import { MentorClient } from '../../packages/mentor-mcp/src/client.mjs';

const SCOPES = ['profile', 'agent', 'byok'];
const now = () => Math.floor(Date.now() / 1000);
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
export const challenge = async value => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
const invalid = (message = 'Invalid OAuth request', status = 400) => { throw new RemoteError(status, message); };
const safe = value => typeof value === 'string' && value.length <= 2048;
const validResource = (resource, env) => resource === env.REMOTE_ORIGIN + '/mcp';
function redirects(values) {
  if (!Array.isArray(values) || !values.length || values.length > 10) invalid('Invalid redirect_uris');
  return values.map(value => {
    if (!safe(value)) invalid('Invalid redirect URI');
    let url; try { url = new URL(value); } catch { invalid('Invalid redirect URI'); }
    if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) invalid('Redirect must use HTTPS or loopback HTTP');
    return url.toString();
  });
}
function scopes(value) {
  if (typeof value !== 'string' || value.length > 100) invalid('Invalid scope');
  const list = [...new Set(value.split(' ').filter(Boolean))];
  if (!list.length || list.some(s => !SCOPES.includes(s))) invalid('Invalid scope');
  return list;
}
async function input(request) {
  const reader = request.body?.getReader(); let text = '', size = 0;
  if (!reader) invalid('Body required');
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); invalid('Body too large', 413); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (request.headers.get('Content-Type')?.startsWith('application/json')) {
    try { const value = JSON.parse(text); if (!value || Array.isArray(value) || typeof value !== 'object') invalid(); return value; } catch { invalid('Invalid JSON'); }
  }
  if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) invalid('Unsupported content type', 415);
  const params = new URLSearchParams(text);
  if ([...params.keys()].some(key => params.getAll(key).length > 1)) invalid('Duplicate parameter');
  return Object.fromEntries(params);
}
export async function oauthStore(env, op, data = {}) {
  if (!env.REMOTE_OAUTH) throw new RemoteError(503, 'OAuth storage is not configured');
  const stub = env.REMOTE_OAUTH.get(env.REMOTE_OAUTH.idFromName('oauth-v1'));
  const response = await stub.fetch(new Request('https://internal/' + op, { method: 'POST', body: JSON.stringify(data) }));
  const result = await response.json();
  if (!response.ok) throw new RemoteError(response.status, result.error || 'OAuth unavailable');
  return result;
}
export async function oauthIdentity(token, env) {
  if (!/^osm_[A-Za-z0-9_-]{43}$/.test(token)) throw new RemoteError(401, 'Invalid OAuth access token');
  const result = await oauthStore(env, 'verify', { digest: await hash(token), resource: env.REMOTE_ORIGIN + '/mcp' });
  if (!result.user) throw new RemoteError(401, 'OAuth access token expired or revoked');
  return result.user;
}

/** Private authorization records; no public endpoint exposes this binding. */
export class RemoteOAuthState {
  constructor(state, env, fetcher = fetch) { this.state = state; this.env = env; this.queue = Promise.resolve(); this.fetcher = (url, init) => fetcher(url, { ...init, signal: AbortSignal.timeout(10000) }); }
  fetch(request) {
    // Serialize network-spanning approval consumption as well as storage transactions.
    const work = this.queue.then(() => this.handle(request));
    this.queue = work.catch(() => {});
    return work;
  }
  async handle(request) {
    try {
      const data = await request.json(), op = new URL(request.url).pathname.slice(1), storage = this.state.storage;
      const read = async key => { const row = await storage.get(key); return row?.exp > now() ? row : null; };
      if (op === 'register') {
        // A global admission budget supplements the approximate per-IP rate limiter.
        const day = new Date().toISOString().slice(0, 10);
        const limit = await storage.get('admission');
        const count = limit?.day === day ? limit.count : 0;
        if (count >= 1000) return json({ error: 'Client registration budget exceeded' }, 429);
        const client_id = random();
        await storage.put('client:' + client_id, { ...data, client_id, exp: now() + 30 * 86400 });
        await storage.put('admission', { day, count: count + 1 });
        await storage.setAlarm(Date.now() + 3600000);
        return json({ client_id, ...data, client_id_issued_at: now(), token_endpoint_auth_method: 'none' });
      }
      if (op === 'client') return json({ client: await read('client:' + data.id) });
      if (op === 'start') {
        const day = new Date().toISOString().slice(0, 10);
        const budget = await storage.get('flow-admission');
        const count = budget?.day === day ? budget.count : 0;
        if (count >= 1000) return json({ error: 'Authorization budget exceeded' }, 429);
        await storage.put('flow-admission', { day, count: count + 1 });
        const verifier = random();
        const client = new MentorClient({ OSM_BASE_URL: this.env.WEBSITE_ORIGIN }, this.fetcher);
        const { data: device } = await client.json(new URL('/api/mcp/device/start', client.base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: await challenge(verifier), locale: data.locale }) });
        const target = new URL(device.authorizationUrl);
        if (target.origin !== client.base.origin || target.pathname !== '/api/mcp/connect') invalid('Invalid website authorization URL', 502);
        const id = random();
        await storage.put('flow:' + id, { ...data, verifier, device, exp: now() + 600, nextPoll: 0 });
        await storage.setAlarm(Date.now() + 3600000);
        return json({ id, authorizationUrl: target.toString(), confirmationCode: device.confirmationCode });
      }
      if (op === 'poll') {
        const flow = await read('flow:' + data.id);
        if (!flow || flow.cookie !== data.cookie || flow.csrf !== data.csrf) invalid('Authorization expired or invalid', 403);
        if (flow.completed) return json({ redirect: flow.completed });
        if (flow.nextPoll > now()) return json({ pending: true });
        await storage.put('flow:' + data.id, { ...flow, nextPoll: now() + 5 });
        const client = new MentorClient({ OSM_BASE_URL: this.env.WEBSITE_ORIGIN }, this.fetcher);
        const result = flow.approved || (await client.json(new URL('/api/mcp/device/poll', client.base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestToken: flow.device.requestToken, verifier: flow.verifier }) })).data;
        const target = new URL(flow.redirect_uri);
        if (flow.state) target.searchParams.set('state', flow.state);
        if (result.status === 'denied') {
          target.searchParams.set('error', 'access_denied');
        } else if (result.status === 'connected') {
          // Persist one-time website redemption before a profile read can fail.
          await storage.put('flow:' + data.id, { ...flow, approved: result, nextPoll: now() + 5 });
          // Website validates signature, expiry and account ownership; never trust unverified claims.
          await client.json(new URL('/api/mcp/profile', client.base), { method: 'GET', headers: { Authorization: 'Bearer ' + result.token } });
          const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(result.token.split('.')[0].replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))));
          if (typeof payload.userId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(payload.userId) || !Number.isFinite(result.expiresAt) || result.expiresAt <= now()) invalid('Invalid website identity', 502);
          const code = random();
          await storage.put('code:' + await hash(code), { ...flow, user: 'web-' + payload.userId, websiteToken: result.token, websiteExp: result.expiresAt, exp: now() + 120 });
          target.searchParams.set('code', code);
        } else return json({ pending: true });
        // Delete proof and device grant once consumed; retry returns only the same short-lived code.
        await storage.put('flow:' + data.id, { cookie: flow.cookie, csrf: flow.csrf, completed: target.toString(), exp: now() + 120 });
        return json({ redirect: target.toString() });
      }
      if (op === 'token') {
        let grant, grantId;
        if (data.grant_type === 'authorization_code') {
          const key = 'code:' + await hash(data.code || '');
          const code = await read(key);
          if (!code || code.client_id !== data.client_id || code.redirect_uri !== data.redirect_uri || code.resource !== data.resource || !/^[A-Za-z0-9._~-]{43,128}$/.test(data.code_verifier || '') || await challenge(data.code_verifier) !== code.code_challenge) invalid('invalid_grant');
          await storage.delete(key); // Single-use even if later binding fails.
          grantId = random();
          grant = { user: code.user, scopes: code.scopes, client_id: code.client_id, resource: code.resource, exp: Math.min(now() + 7 * 86400, code.websiteExp), revoked: false };
          const id = await hash('principal:' + this.env.WEBSITE_ORIGIN + ':' + grant.user);
          const stub = this.env.REMOTE_USERS.get(this.env.REMOTE_USERS.idFromName(id));
          const bound = await stub.fetch(new Request('https://internal/bind', { method: 'POST', body: JSON.stringify({ token: code.websiteToken, expiresAt: code.websiteExp }) }));
          if (!bound.ok) invalid('temporarily_unavailable', 503);
        } else if (data.grant_type === 'refresh_token') {
          const digest = await hash(data.refresh_token || '');
          const previous = await read('refresh:' + digest);
          if (!previous || previous.client_id !== data.client_id) invalid('invalid_grant');
          grantId = previous.grantId; grant = await read('grant:' + grantId);
          if (!grant || grant.revoked || grant.resource !== data.resource) invalid('invalid_grant');
          if (grant.refresh !== digest) {
            await storage.put('grant:' + grantId, { ...grant, revoked: true });
            invalid('invalid_grant'); // Refresh reuse revokes the entire family.
          }
        } else invalid('unsupported_grant_type');
        const access_token = 'osm_' + random(), refresh_token = 'osr_' + random();
        if ((grant.rotations || 0) >= 200) invalid('invalid_grant');
        grant.rotations = (grant.rotations || 0) + 1;
        const accessExp = Math.min(now() + 3600, grant.exp);
        grant.refresh = await hash(refresh_token);
        await storage.put('grant:' + grantId, grant);
        await storage.put('access:' + await hash(access_token), { grantId, exp: accessExp });
        await storage.put('refresh:' + grant.refresh, { grantId, client_id: grant.client_id, exp: grant.exp });
        await storage.setAlarm(Date.now() + 3600000);
        return json({ access_token, refresh_token, token_type: 'Bearer', expires_in: accessExp - now(), scope: grant.scopes.join(' ') });
      }
      if (op === 'verify') {
        const access = await read('access:' + data.digest);
        const grant = access ? await read('grant:' + access.grantId) : null;
        return json({ user: grant && !grant.revoked && grant.resource === data.resource ? { id: grant.user, scopes: grant.scopes } : null });
      }
      if (op === 'revoke') {
        const digest = await hash(data.token || '');
        const row = await read('access:' + digest) || await read('refresh:' + digest);
        const grant = row ? await read('grant:' + row.grantId) : null;
        if (grant && grant.client_id === data.client_id) await storage.put('grant:' + row.grantId, { ...grant, revoked: true });
        return json({});
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json({ error: error instanceof RemoteError ? error.message : 'temporarily_unavailable' }, error instanceof RemoteError ? error.status : 503);
    }
  }
  async alarm() {
    // Bound each pass, continue alarms until all keys have been scanned.
    const cursor = await this.state.storage.get('gc-cursor');
    const rows = await this.state.storage.list({ limit: 1000, ...(cursor ? { startAfter: cursor } : {}) });
    for (const [key, row] of rows) if (row?.exp && row.exp <= now()) await this.state.storage.delete(key);
    if (rows.size === 1000) await this.state.storage.put('gc-cursor', [...rows.keys()].at(-1));
    else await this.state.storage.delete('gc-cursor');
    await this.state.storage.setAlarm(Date.now() + (rows.size === 1000 ? 60000 : 3600000));
  }
}

export async function handleOAuth(request, env) {
  const url = new URL(request.url), origin = env.REMOTE_ORIGIN;
  const resource = origin + '/mcp';
  if (request.method === 'GET' && ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(url.pathname)) return json({ resource, authorization_servers: [origin], scopes_supported: SCOPES, bearer_methods_supported: ['header'] });
  if (request.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') return json({ issuer: origin, authorization_endpoint: origin + '/oauth/authorize', token_endpoint: origin + '/oauth/token', registration_endpoint: origin + '/oauth/register', revocation_endpoint: origin + '/oauth/revoke', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: SCOPES });
  if (request.method === 'POST' && url.pathname === '/oauth/register') {
    const body = await input(request);
    if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') invalid('Only public PKCE clients are supported');
    return json(await oauthStore(env, 'register', { client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : 'MCP Agent', redirect_uris: redirects(body.redirect_uris), grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }), 201);
  }
  if (request.method === 'GET' && url.pathname === '/oauth/authorize') {
    if ([...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length > 1)) invalid('Duplicate parameter');
    const data = Object.fromEntries(url.searchParams);
    if (data.response_type !== 'code' || data.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(data.code_challenge || '') || !validResource(data.resource, env) || (data.state !== undefined && !safe(data.state))) invalid('Code, S256 and exact resource are required');
    const { client } = await oauthStore(env, 'client', { id: data.client_id });
    if (!client || !client.redirect_uris.includes(data.redirect_uri)) invalid('Unregistered client or redirect URI');
    const requested = scopes(data.scope || 'profile agent');
    const cookie = random(), csrf = random();
    const zh = data.ui_locales?.startsWith('zh') || request.headers.get('Accept-Language')?.startsWith('zh');
    const flow = await oauthStore(env, 'start', { client_id: data.client_id, redirect_uri: data.redirect_uri, resource, code_challenge: data.code_challenge, state: data.state, scopes: requested, cookie: await hash(cookie), csrf: await hash(csrf), locale: zh ? 'zh-CN' : 'en-US' });
    const nonce = random();
    const script = `const status=document.getElementById('status');async function poll(){try{const r=await fetch('/oauth/poll?id=${flow.id}',{method:'POST',headers:{'X-CSRF':'${csrf}'}});const x=await r.json();if(x.redirect){location.replace(x.redirect);return;}if(!r.ok){status.textContent=${JSON.stringify(zh ? '授权失败或过期，请回到 Agent 重新连接。' : 'Authorization failed or expired. Reconnect from your Agent.')};return;}}catch{}setTimeout(poll,5000)}setTimeout(poll,5000);`;
    const body = `<!doctype html><html lang="${zh ? 'zh-CN' : 'en-US'}"><meta charset="utf-8"><title>OpenSource Mentor OAuth</title><body><h1>${zh ? '连接 OpenSource Mentor' : 'Connect OpenSource Mentor'}</h1><p>${zh ? '客户端（名称由客户端提供）：' : 'Client (self-reported name): '}${escape(client.client_name)}</p><p>${zh ? '授权返回地址：' : 'Return address: '}${escape(data.redirect_uri)}</p><p>${zh ? '申请权限：' : 'Requested permissions: '}${escape(requested.join(', '))}</p><p>${zh ? '不授予 GitHub 写入权限，不共享 AI 密钥。画像保存和同步仍需你的确认。请核对网页连接码：' : 'No GitHub write permission or AI keys are shared. Saving and syncing profiles still needs your consent. Verify website code: '}${escape(flow.confirmationCode)}</p><a target="_blank" rel="noopener noreferrer" href="${escape(flow.authorizationUrl)}">${zh ? '打开网页，登录 GitHub 并同意或拒绝' : 'Open website, sign in with GitHub and approve or deny'}</a><p id="status">${zh ? '完成网页批准后保留本页，它会自动返回 Agent，无需复制凭证。' : 'Keep this page open after website approval. It returns to your Agent automatically; no credentials to copy.'}</p><script nonce="${nonce}">${script}</script></body></html>`;
    return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': `osm_oauth_${flow.id}=${cookie}; Path=/oauth/poll; HttpOnly; SameSite=Strict; Max-Age=600${url.protocol === 'https:' ? '; Secure' : ''}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'` } });
  }
  if (request.method === 'POST' && url.pathname === '/oauth/poll') {
    const id = url.searchParams.get('id');
    if (!/^[A-Za-z0-9_-]{43}$/.test(id || '') || request.headers.get('Origin') !== origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') invalid('Confirm from this authorization page', 403);
    const cookie = (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('osm_oauth_' + id + '='))?.split('=')[1];
    if (!cookie || !request.headers.get('X-CSRF')) invalid('Browser proof required', 403);
    return json(await oauthStore(env, 'poll', { id, cookie: await hash(cookie), csrf: await hash(request.headers.get('X-CSRF')) }));
  }
  if (request.method === 'POST' && ['/oauth/token', '/oauth/revoke'].includes(url.pathname)) {
    const data = await input(request);
    if (!safe(data.client_id) || !(await oauthStore(env, 'client', { id: data.client_id })).client) invalid('invalid_client');
    if (url.pathname === '/oauth/token' && !validResource(data.resource, env)) invalid('invalid_target');
    // This MVP keeps the granted scope fixed; narrower refresh scopes are not supported.
    if (data.scope !== undefined) invalid('Scope changes require a new authorization');
    return json(await oauthStore(env, url.pathname.endsWith('/token') ? 'token' : 'revoke', data));
  }
  return json({ error: 'Unsupported OAuth endpoint or method' }, 404);
}
