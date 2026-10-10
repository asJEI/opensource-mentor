import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

export class ProfileStore {
  constructor(client) {
    this.client = client;
    this.path = join(client.env.OSM_STATE_DIR || join(homedir(), '.opensource-mentor'), createHash('sha256').update(client.base.origin).digest('hex').slice(0, 16) + '.json');
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
    const state = await this.read();
    let pending = state.pendingConnection;
    if (!pending || pending.expiresAt <= Date.now() / 1000) {
      const verifier = randomBytes(32).toString('base64url');
      const { data } = await this.client.json(new URL('/api/mcp/device/start', this.client.base), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: createHash('sha256').update(verifier).digest('base64url'), locale }),
      });
      const authorization = new URL(data.authorizationUrl);
      if (authorization.origin !== this.client.base.origin || authorization.pathname !== '/api/mcp/connect') throw new Error('Invalid authorization URL returned by the service.');
      pending = { verifier, requestToken: data.requestToken, url: authorization.toString(), confirmationCode: data.confirmationCode, expiresAt: data.expiresAt, nextPollAt: 0, interval: Math.max(5, Number(data.interval) || 5) };
      await this.write({ ...state, pendingConnection: pending });
    }
    return { authorizationUrl: pending.url, confirmationCode: pending.confirmationCode, status: 'awaiting_browser', expiresAt: pending.expiresAt, instructions: 'Open this link in any browser, sign in with GitHub, verify the displayed connection code, approve profile access, then call account_connection_status. The Agent can run locally or in the cloud. Do not paste credentials into chat. No local profile is uploaded automatically.' };
  }
  async status() {
    const state = await this.read();
    const pending = state.pendingConnection;
    if (pending) {
      if (pending.expiresAt <= Date.now() / 1000) {
        await this.write({ ...state, pendingConnection: null });
        return { status: 'expired' };
      }
      if (pending.nextPollAt > Date.now()) return { status: 'awaiting_browser', retryAfterSeconds: Math.ceil((pending.nextPollAt - Date.now()) / 1000) };
      // Enforce a polling interval, including when the network fails; never loop in a tool call.
      await this.write({ ...state, pendingConnection: { ...pending, nextPollAt: Date.now() + pending.interval * 1000 } });
      let result;
      try {
        result = (await this.client.json(new URL('/api/mcp/device/poll', this.client.base), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestToken: pending.requestToken, verifier: pending.verifier }),
        })).data;
      } catch (error) {
        throw new Error(String(error.message).split(pending.verifier).join('[redacted]').split(pending.requestToken).join('[redacted]'));
      }
      if (result.status === 'denied') {
        await this.write({ ...state, pendingConnection: null });
        return { status: 'denied' };
      }
      if (result.status === 'connected') {
        // Persist the credential before a subsequent profile read can fail; discard the old account's cache.
        await this.write({ token: result.token, expiresAt: result.expiresAt, profile: null });
        const remote = await this.remote(result);
        await this.write({ token: result.token, expiresAt: result.expiresAt, profile: remote.profile, username: remote.username });
        return { status: 'connected', username: remote.username, expiresAt: result.expiresAt };
      }
      return { status: 'awaiting_browser', retryAfterSeconds: pending.interval };
    }
    return { status: state.token ? state.expiresAt <= Date.now() / 1000 ? 'expired' : 'connected' : 'disconnected', username: state.username || null, expiresAt: state.expiresAt || null };
  }
  async disconnect() {
    const state = await this.read();
    let revoked = !state.token;
    if (state.token) { try { await this.remote(state, 'DELETE'); revoked = true; } catch { /* Clear local credentials even when offline or expired; disclose failed revocation. */ } }
    await this.write({});
    return { disconnected: true, localProfileCleared: true, revoked, ...(!revoked ? { warning: 'Server revocation failed. Local credentials were removed; the existing grant expires after seven days or is invalidated by a new browser connection.' } : {}) };
  }
}
