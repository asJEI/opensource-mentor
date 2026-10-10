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
test('cloud authorization needs no loopback, survives restart and keeps proof private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentor-connect-'));
  const calls = [];
  let approved = false;
  const client = new MentorClient({ OSM_STATE_DIR: dir, OSM_BASE_URL: 'https://mentor.example' }, async (url, init) => {
    calls.push({ url, init });
    if (url.pathname.endsWith('/start')) return Response.json({ success: true, data: { requestToken: 'signed-request', authorizationUrl: 'https://mentor.example/api/mcp/connect?request=signed-request', confirmationCode: 'ABCD1234', expiresAt: 9999999999, interval: 5 } });
    if (url.pathname.endsWith('/poll')) return Response.json({ success: true, data: approved ? { status: 'connected', token: 'private-test-credential', expiresAt: 9999999999 } : { status: 'awaiting_browser' } });
    return Response.json({ success: true, data: { profile: null, username: 'new-account' } });
  });
  const store = new ProfileStore(client);
  try {
    await store.save(profile, false);
    const start = await store.connect('zh-CN');
    const url = new URL(start.authorizationUrl);
    assert.equal(url.origin, 'https://mentor.example');
    assert.equal(url.searchParams.has('callback'), false);
    assert.equal(start.confirmationCode, 'ABCD1234');
    assert.ok(!JSON.stringify(start).includes('verifier'));
    const resumed = new ProfileStore(client);
    assert.equal((await resumed.connect()).authorizationUrl, start.authorizationUrl);
    assert.equal(calls.filter(c => c.url.pathname.endsWith('/start')).length, 1);
    assert.equal((await resumed.status()).status, 'awaiting_browser');
    assert.equal((await resumed.status()).status, 'awaiting_browser');
    assert.equal(calls.filter(c => c.url.pathname.endsWith('/poll')).length, 1);
    const pending = await resumed.read();
    approved = true;
    await resumed.write({ ...pending, pendingConnection: { ...pending.pendingConnection, nextPollAt: 0 } });
    const status = await resumed.status();
    assert.equal(status.status, 'connected');
    assert.ok(!JSON.stringify(status).includes('private-test-credential'));
    assert.equal((await resumed.get()).profile, null);
    assert.ok(calls.every(c => c.init.method !== 'PUT'));
    assert.equal(JSON.parse(calls.find(c => c.url.pathname.endsWith('/poll')).init.body).verifier.length, 43);
    await resumed.save(profile, true);
    assert.equal(calls.at(-1).init.method, 'PUT');
    await resumed.disconnect();
    assert.equal(calls.at(-1).init.method, 'DELETE');
  } finally { await rm(dir, { recursive: true }); }
});
test('denied and expired authorizations do not create credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mentor-denied-'));
  const client = new MentorClient({ OSM_STATE_DIR: dir }, async () => Response.json({ success: true, data: { status: 'denied' } }));
  const store = new ProfileStore(client);
  try {
    const pendingConnection = { verifier: 'v', requestToken: 'r', expiresAt: 9999999999, interval: 5, nextPollAt: 0 };
    await store.write({ pendingConnection });
    assert.equal((await store.status()).status, 'denied');
    assert.equal((await store.read()).token, undefined);
    await store.write({ pendingConnection: { ...pendingConnection, expiresAt: 1 } });
    assert.equal((await store.status()).status, 'expired');
  } finally { await rm(dir, { recursive: true }); }
});
