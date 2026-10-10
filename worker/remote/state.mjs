import { ProfileSession } from '../../packages/mentor-mcp/src/profileSession.mjs';
import { MentorClient } from '../../packages/mentor-mcp/src/client.mjs';

class DurableProfiles extends ProfileSession {
  constructor(client, storage) { super(client); this.storage = storage; }
  async read() { return await this.storage.get('profile') || {}; }
  async write(value) { await this.storage.put('profile', value); }
}

/** One object per immutable remote principal. Never keyed by MCP session ID or IP. */
export class RemoteUserState {
  constructor(state, env) { this.state = state; this.env = env; this.queue = Promise.resolve(); }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const input = await request.json();
    if (path === '/charge') {
      const result = await this.state.storage.transaction(async tx => {
        const now = Date.now();
        const day = new Date(now).toISOString().slice(0, 10);
        let quota = await tx.get('quota');
        if (!quota || quota.day !== day) quota = { day, total: 0, website: 0, leases: quota?.leases || {} };
        for (const [id, expiry] of Object.entries(quota.leases)) if (expiry < now) delete quota.leases[id];
        if (quota.total >= 200 || (input.website && quota.website >= 20) || Object.keys(quota.leases).length >= 2) return false;
        quota.total++; if (input.website) quota.website++;
        quota.leases[input.lease] = now + 10 * 60 * 1000;
        await tx.put('quota', quota);
        return true;
      });
      return Response.json({ allowed: result });
    }
    if (path === '/release') {
      await this.state.storage.transaction(async tx => {
        const quota = await tx.get('quota');
        if (quota) { delete quota.leases[input.lease]; await tx.put('quota', quota); }
      });
      return Response.json({ ok: true });
    }
    const operation = path.slice(1);
    if (!['get', 'save', 'connect', 'status', 'disconnect'].includes(operation)) return new Response('Not found', { status: 404 });
    // Serialize profile transactions spanning network requests, so a stale read cannot restore a revoked token.
    const work = this.queue.then(async () => {
      try {
        const client = new MentorClient({ OSM_BASE_URL: this.env.WEBSITE_ORIGIN });
        const profiles = new DurableProfiles(client, this.state.storage);
        const result = await profiles[operation](...(input.args || []));
        if (result.storage === 'local') result.storage = 'remote-private';
        return Response.json({ data: result });
      } catch { return Response.json({ error: 'Account operation failed; verify website availability and reconnect if needed' }, { status: 502 }); }
    });
    this.queue = work.catch(() => {});
    return work;
  }
}

export function remoteProfiles(stub) {
  const call = async (operation, ...args) => {
    const response = await stub.fetch(new Request(`https://internal/${operation}`, { method: 'POST', body: JSON.stringify({ args }) }));
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account operation failed');
    return result.data;
  };
  return Object.fromEntries(['get', 'save', 'connect', 'status', 'disconnect'].map(op => [op, (...args) => call(op, ...args)]));
}
