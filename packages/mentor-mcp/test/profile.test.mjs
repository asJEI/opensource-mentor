import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MentorClient } from '../src/client.mjs';
import { ProfileStore } from '../src/profile.mjs';
import { createServer } from '../src/server.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const profile = { profileSetupStatus: 'completed', programmingLanguages: ['typescript'], experienceLevel: 'beginner', interests: ['frontend'], goals: ['first_contribution'], weeklyHours: 5, locale: 'zh-CN' };
test('onboarding persists without a login and never guesses missing experience', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentor-profile-'));
  const client = new MentorClient({ OSM_STATE_DIR: dir }, () => { throw new Error('No network expected'); });
  const store = new ProfileStore(client);
  const server = createServer(client);
  const host = new Client({ name: 'profile-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await host.connect(b);
  try {
    assert.equal((await store.get()).onboardingRequired, true);
    const { experienceLevel, ...incomplete } = profile;
    assert.equal((await host.callTool({ name: 'save_user_profile', arguments: { profile: incomplete } })).isError, true);
    assert.equal((await host.callTool({ name: 'save_user_profile', arguments: { profile } })).isError, undefined);
    assert.deepEqual((await new ProfileStore(client).get()).profile, profile);
    await assert.rejects(store.save(profile, true), /Connect/);
    assert.equal((await store.disconnect()).localProfileCleared, true);
    assert.equal((await store.get()).profile, null);
  } finally { await host.close(); await server.close(); await rm(dir, { recursive: true }); }
});
test('browser callback validates state, keeps credentials private, and does not upload local data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentor-connect-'));
  const calls = [];
  const client = new MentorClient({ OSM_STATE_DIR: dir, OSM_BASE_URL: 'https://mentor.example' }, async (url, init) => {
    calls.push({ url, init });
    if (url.pathname.endsWith('/exchange')) return Response.json({ success: true, data: { token: 'private-test-credential', expiresAt: 9999999999 } });
    return Response.json({ success: true, data: { profile: null, username: 'new-account' } });
  });
  const store = new ProfileStore(client);
  try {
    await store.save(profile, false);
    const start = await store.connect('zh-CN');
    const url = new URL(start.authorizationUrl);
    const callback = new URL(url.searchParams.get('callback'));
    callback.searchParams.set('code', 'private-code'); callback.searchParams.set('state', 'wrong');
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', url.searchParams.get('state'));
    assert.equal((await fetch(callback)).status, 200);
    const status = await store.status();
    assert.equal(status.status, 'connected');
    assert.ok(!JSON.stringify(status).includes('private-test-credential'));
    assert.equal((await store.get()).profile, null);
    assert.ok(calls.every(c => c.init.method !== 'PUT'));
    const exchange = JSON.parse(calls[0].init.body);
    assert.equal(exchange.verifier.length, 43);
    assert.equal(exchange.code, 'private-code');
    await store.save(profile, true);
    assert.equal(calls.at(-1).init.method, 'PUT');
    await store.disconnect();
    assert.equal(calls.at(-1).init.method, 'DELETE');
  } finally { await rm(dir, { recursive: true }); }
});
