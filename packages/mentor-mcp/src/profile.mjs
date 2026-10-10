import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';

export class ProfileStore {
  constructor(client) {
    this.client = client;
    this.path = join(client.env.OSM_STATE_DIR || join(homedir(), '.opensource-mentor'), createHash('sha256').update(client.base.origin).digest('hex').slice(0, 16) + '.json');
    this.pending = null;
    this.queue = Promise.resolve();
  }
  async read() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('Cannot read Mentor state; check local file permissions.'); }
  }
  async write(state) {
    const operation = this.queue.then(async () => {
      await mkdir(join(this.path, '..'), { recursive: true, mode: 0o700 });
      const temp = this.path + '.' + randomBytes(8).toString('hex') + '.tmp';
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, this.path);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async remote(state, method = 'GET', profile) {
    try {
      return (await this.client.json(new URL('/api/mcp/profile', this.client.base), { method, headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' }, ...(profile ? { body: JSON.stringify(profile) } : {}) })).data;
    } catch (error) { throw new Error(String(error.message).split(state.token).join('[redacted]')); }
  }
  async get() {
    const state = await this.read();
    if (state.token) {
      const remote = await this.remote(state);
      // Account data takes precedence; never upload a previous account's local profile automatically.
      await this.write({ ...state, profile: remote.profile, username: remote.username });
      const profile = state.localProfile ?? remote.profile;
      return { ...remote, profile, connected: true, storage: state.localProfile ? 'local' : 'website', onboardingRequired: !profile || profile.profileSetupStatus === 'not_started' };
    }
    return { profile: state.profile || null, connected: false, storage: 'local', onboardingRequired: !state.profile || state.profile.profileSetupStatus === 'not_started', instructions: 'Ask only for missing languages, experience, interests, goals, weekly hours and language. Do not infer skill from installing git/npm. Account connection is optional.' };
  }
  async save(profile, sync) {
    const state = await this.read();
    if (sync) {
      if (!state.token) throw new Error('Connect your web account before syncing. You can save locally without signing in.');
      await this.remote(state, 'PUT', profile);
    }
    await this.write({ ...state, profile, localProfile: sync ? null : profile });
    return { profile, storage: sync ? 'website' : 'local', synced: sync };
  }
  async connect(locale = 'en-US') {
    if (this.pending) return { authorizationUrl: this.pending.url, status: this.pending.status };
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const pending = { status: 'awaiting_browser', url: '' };
    const listener = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (req.method !== 'GET' || url.pathname !== '/callback' || url.searchParams.get('state') !== state || !url.searchParams.get('code') || pending.status !== 'awaiting_browser') { res.writeHead(400); res.end('Invalid connection callback'); return; }
      pending.status = 'connecting';
      try {
        const { data } = await this.client.json(new URL('/api/mcp/exchange', this.client.base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: url.searchParams.get('code'), verifier }) });
        const remote = await this.remote(data);
        await this.write({ token: data.token, expiresAt: data.expiresAt, profile: remote.profile, username: remote.username });
        pending.status = 'connected';
        res.end(locale === 'zh-CN' ? '连接成功。返回 Agent 继续填写画像。' : 'Connected. Return to your Agent to continue onboarding.');
      } catch { pending.status = 'failed'; res.writeHead(502); res.end('Connection failed. Return to the Agent and retry.'); }
      finally { clearTimeout(timer); listener.close(); }
    });
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    const url = new URL('/api/mcp/connect', this.client.base);
    url.searchParams.set('callback', `http://127.0.0.1:${listener.address().port}/callback`);
    url.searchParams.set('state', state); url.searchParams.set('challenge', createHash('sha256').update(verifier).digest('base64url')); url.searchParams.set('locale', locale);
    pending.url = url.toString(); this.pending = pending;
    const timer = setTimeout(() => { pending.status = 'expired'; listener.close(); }, 10 * 60 * 1000); timer.unref(); listener.unref();
    return { authorizationUrl: pending.url, status: pending.status, instructions: 'Open this link on the same computer as the MCP process, sign in with GitHub, approve profile access, then call account_connection_status. Do not paste credentials into chat. No local profile is uploaded automatically.' };
  }
  async status() {
    if (this.pending && ['failed', 'expired'].includes(this.pending.status)) { const status = this.pending.status; this.pending = null; return { status }; }
    if (this.pending?.status === 'connected') this.pending = null;
    const state = await this.read();
    return { status: this.pending?.status || (state.token ? state.expiresAt <= Date.now() / 1000 ? 'expired' : 'connected' : 'disconnected'), username: state.username || null, expiresAt: state.expiresAt || null };
  }
  async disconnect() {
    if (this.pending && !['connected', 'expired', 'failed'].includes(this.pending.status)) throw new Error('Finish or let the pending browser connection expire before disconnecting.');
    const state = await this.read();
    let revoked = !state.token;
    if (state.token) { try { await this.remote(state, 'DELETE'); revoked = true; } catch { /* Clear local credentials even when offline or expired; disclose failed revocation. */ } }
    this.pending = null;
    await this.write({});
    return { disconnected: true, localProfileCleared: true, revoked, ...(!revoked ? { warning: 'Server revocation failed. Local credentials were removed; the existing grant expires after seven days or is invalidated by a new browser connection.' } : {}) };
  }
}
