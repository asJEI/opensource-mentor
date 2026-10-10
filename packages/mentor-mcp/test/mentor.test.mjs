import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MentorClient } from '../src/client.mjs';
import { createServer } from '../src/server.mjs';
import { fileURLToPath } from 'node:url';

test('website calls preserve contract, locale and header-only credentials', async () => {
  const calls = [];
  const client = new MentorClient({ OSM_BASE_URL: 'https://mentor.example', OSM_GITHUB_TOKEN: 'test-token', OSM_AI_KEY: 'test-secret', OSM_AI_MODEL: 'test-model' }, async (url, init) => {
    calls.push({ url, init });
    return Response.json({ success: true, data: { ok: true } });
  });
  await client.api('/ai/recommend-issues', { owner: 'a', repo: 'b', locale: 'zh-CN', userProfile: { experienceLevel: 'beginner' } });
  const { url, init } = calls[0];
  assert.equal(url.pathname, '/api/ai/recommend-issues');
  assert.equal(init.headers['Accept-Language'], 'zh-CN');
  assert.equal(init.headers['X-AI-Key'], 'test-secret');
  assert.equal(init.headers['X-User-GitHub-Token'], 'test-token');
  assert.equal(init.redirect, 'error');
  assert.ok(!init.body.includes('test-secret'));
  assert.ok(!String(url).includes('test-token'));
  assert.equal(JSON.parse(init.body).userProfile.experienceLevel, 'beginner');
});

test('reject unsafe configured origins and redact exact secrets in failures', async () => {
  for (const url of ['http://remote.example', 'https://user:pass@example.com', 'https://example.com/path', 'file:///tmp']) {
    assert.throws(() => new MentorClient({ OSM_BASE_URL: url }));
  }
  const client = new MentorClient({ OSM_AI_KEY: 'arbitrary-secret' }, async () => Response.json({ success: false, message: 'arbitrary-secret failed', errorCode: 'AI_ERROR' }, { status: 503 }));
  await assert.rejects(client.api('/ai/chat', {}), /\[redacted\] failed/);
});

test('real MCP protocol lists tools, validates inputs and forwards roadmap issue/profile', async () => {
  const calls = [];
  const adapter = new MentorClient({}, async () => Response.json({ success: true, data: {} }));
  adapter.api = async (path, args) => { calls.push({ path, args }); return { title: '学习计划' }; };
  const server = createServer(adapter);
  const host = new Client({ name: 'test-host', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await host.connect(b);
  try {
    const tools = (await host.listTools()).tools;
    assert.equal(tools.length, 12);
    assert.equal(tools.find(t => t.name === 'review_pull_request').annotations.readOnlyHint, false);
    const result = await host.callTool({ name: 'generate_learning_plan', arguments: { owner: 'a', repo: 'b', issueNumber: 42, locale: 'zh-CN', userProfile: { programmingLanguages: ['python'], experienceLevel: 'some_experience' } } });
    assert.equal(result.isError, undefined);
    assert.equal(calls[0].args.issueContext.issue.number, 42);
    assert.deepEqual(calls[0].args.userProfile.programmingLanguages, ['python']);
    assert.equal(calls[0].args.userProfile.experienceLevel, 'some_experience');
    const invalid = await host.callTool({ name: 'get_repository', arguments: { owner: '..', repo: 'b' } });
    assert.equal(invalid.isError, true);
    assert.equal(calls.length, 1);
    await host.callTool({ name: 'mentor_chat', arguments: { owner: 'a', repo: 'b', locale: 'en-US', message: 'Help' } });
    assert.equal(calls[1].args.locale, 'en-US');
  } finally { await host.close(); await server.close(); }
});

test('stdio process initializes without stdout noise', async () => {
  const host = new Client({ name: 'stdio-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/stdio.mjs', import.meta.url))], env: { ...process.env, OSM_BASE_URL: 'http://localhost:5173' } });
  try { await host.connect(transport); assert.equal((await host.listTools()).tools.length, 12); }
  finally { await host.close(); }
});

test('discovery reports incomplete data and preserves repository metadata', async () => {
  const client = new MentorClient({}, async url => {
    assert.equal(url.origin, 'https://api.github.com');
    assert.match(url.searchParams.get('q'), /language:TypeScript archived:false fork:false/);
    return Response.json({ total_count: 1, incomplete_results: true, items: [{ full_name: 'org/repo', html_url: 'https://github.com/org/repo', description: 'Original 中文', topics: ['tool'], stargazers_count: 2 }] });
  });
  const result = await client.searchRepositories({ query: 'tools', language: 'TypeScript' });
  assert.equal(result.incomplete, true);
  assert.equal(result.repositories[0].description, 'Original 中文');
  assert.ok(result.queriedAt);
});

test('explanation uses original issue and repository DTO, rejects PRs', async () => {
  const calls = [];
  const client = new MentorClient({}, async () => Response.json({}));
  client.github = async () => ({ number: 2, title: '原始 Issue', body: 'Code `foo()`', labels: [{ name: 'bug' }], assignees: [], html_url: 'https://github.com/a/b/issues/2', state: 'open' });
  client.api = async (path, args) => { calls.push({ path, args }); return path === '/repository' ? { fullName: 'a/b' } : { summary: 'Explanation' }; };
  const result = await client.explainIssue({ owner: 'a', repo: 'b', issueNumber: 2, locale: 'en-US' });
  assert.equal(calls[1].args.repository.fullName, 'a/b');
  assert.equal(calls[1].args.issue.title, '原始 Issue');
  assert.equal(result.originalBody, 'Code `foo()`');
  client.github = async () => ({ pull_request: {} });
  await assert.rejects(client.explainIssue({ owner: 'a', repo: 'b', issueNumber: 2 }), /pull request/);
});

test('all website feature tools route to the existing API contracts', async () => {
  const calls = [];
  const adapter = new MentorClient();
  adapter.api = async (path, args, method = 'POST') => { calls.push({ path, args, method }); return {}; };
  const server = createServer(adapter);
  const host = new Client({ name: 'routing-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await host.connect(b);
  try {
    const cases = [
      ['get_repository', '/repository', 'GET', {}],
      ['list_issues', '/issues', 'GET', {}],
      ['analyze_repository', '/ai/analyze-repo', 'POST', {}],
      ['recommend_issues', '/ai/recommend-issues', 'POST', { userProfile: {} }],
      ['generate_pr_draft', '/ai/generate-pr', 'POST', { issueNumber: 3, additionalContext: 'Fix actual bug' }],
      ['review_pull_request', '/code-review/reviews', 'POST', { prUrl: 'https://github.com/a/b/pull/1' }],
    ];
    for (const [name, path, method, extra] of cases) {
      const result = await host.callTool({ name, arguments: { owner: 'a', repo: 'b', locale: 'en-US', ...extra } });
      assert.ok(!result.isError, name);
      assert.equal(calls.at(-1).path, path);
      assert.equal(calls.at(-1).method, method);
      assert.equal(calls.at(-1).args.locale, 'en-US');
    }
  } finally { await host.close(); await server.close(); }
});

test('source context reports linked PRs, truncation and partial history', async () => {
  const client = new MentorClient();
  client.github = async path => {
    if (path.endsWith('/comments')) return [{ user: { login: 'contributor' }, body: 'May I work on this?', html_url: 'https://github.com/a/b/issues/1#comment' }];
    if (path.endsWith('/timeline')) return [{ source: { issue: { pull_request: {}, html_url: 'https://github.com/a/b/pull/2', state: 'open', title: 'Fix' } } }];
    return { title: 'Original', body: 'a'.repeat(17000), state: 'open', assignees: [{ login: 'owner' }] };
  };
  const result = await client.issueContext({ owner: 'a', repo: 'b', issueNumber: 1 });
  assert.equal(result.body.length, 16000);
  assert.equal(result.bodyTruncated, true);
  assert.deepEqual(result.assignees, ['owner']);
  assert.equal(result.linkedPullRequests[0].state, 'open');
  assert.match(result.warnings[0], /first 30/);
});

test('repository context only fetches GitHub content paths and decodes documents', async () => {
  const client = new MentorClient();
  const paths = [];
  client.github = async path => {
    paths.push(path);
    if (path.endsWith('/community/profile')) return { files: { contributing: { url: 'https://api.github.com/repos/a/b/contents/CONTRIBUTING.md' } } };
    return { encoding: 'base64', content: Buffer.from('贡献指南 and `code`').toString('base64'), html_url: 'https://github.com/a/b' };
  };
  const result = await client.repositoryContext({ owner: 'a', repo: 'b' });
  assert.equal(result.readme.content, '贡献指南 and `code`');
  assert.equal(result.contributing.content, result.readme.content);
  assert.equal(paths.length, 3);
});

test('website is the default; source metadata does not enter the web API contract', async () => {
  const adapter = new MentorClient({});
  const received = [];
  const generated = await adapter.generate('analyze_repository', { owner: 'a', repo: 'b', modelSource: 'website', locale: 'zh-CN' }, async args => { received.push(args); return { summary: '网页结果' }; });
  assert.equal(generated.modelSource, 'website');
  assert.equal(generated.generationStatus, 'completed');
  assert.equal(generated.result.summary, '网页结果');
  assert.equal(received[0].modelSource, undefined);
  adapter.hostContext = async () => { throw new Error('unexpected host call'); };
  await assert.rejects(adapter.generate('analyze_repository', { locale: 'zh-CN' }, async () => { throw new Error('AUTH_REQUIRED'); }), /未切换到宿主模型/);
});

test('agent generation bypasses every website AI callback and honors explicit override', async () => {
  const adapter = new MentorClient({ OSM_MODEL_SOURCE: 'agent' });
  adapter.hostContext = async (task, args) => ({ task, originalCode: 'const foo = 1;', owner: args.owner });
  for (const task of ['analyze_repository', 'recommend_issues', 'explain_issue', 'generate_learning_plan', 'mentor_chat', 'generate_pr_draft', 'review_pull_request']) {
    const output = await adapter.generate(task, { owner: 'a', locale: 'en-US', message: 'Help' }, async () => { throw new Error('website must not run'); });
    assert.equal(output.modelSource, 'agent');
    assert.equal(output.generationStatus, 'awaiting_host');
    assert.equal(output.locale, 'en-US');
    assert.equal(output.request.message, 'Help');
    assert.equal(output.context.originalCode, 'const foo = 1;');
  }
  const output = await adapter.generate('mentor_chat', { modelSource: 'website' }, async () => 'website');
  assert.equal(output.result, 'website');
  assert.throws(() => new MentorClient({ OSM_MODEL_SOURCE: 'invalid' }));
});

test('MCP mode selector hands off to the host and rejects invalid modes', async () => {
  const adapter = new MentorClient({});
  adapter.hostContext = async () => ({ readme: 'Original source' });
  adapter.api = async () => { throw new Error('AI API must not run'); };
  const server = createServer(adapter);
  const host = new Client({ name: 'mode-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await host.connect(b);
  try {
    const output = await host.callTool({ name: 'mentor_chat', arguments: { owner: 'a', repo: 'b', message: 'Explain', modelSource: 'agent', locale: 'zh-CN' } });
    assert.equal(output.structuredContent.data.generationStatus, 'awaiting_host');
    assert.equal(output.structuredContent.data.context.readme, 'Original source');
    const invalid = await host.callTool({ name: 'mentor_chat', arguments: { owner: 'a', repo: 'b', message: 'Explain', modelSource: 'unknown' } });
    assert.equal(invalid.isError, true);
  } finally { await host.close(); await server.close(); }
});

test('host recommendations gather GitHub evidence without web or AI credentials', async () => {
  const seen = [];
  const adapter = new MentorClient({}, async url => {
    seen.push(url);
    assert.equal(url.origin, 'https://api.github.com');
    if (url.pathname.endsWith('/issues')) return Response.json([{ number: 1, title: 'Original', body: 'text', html_url: 'https://github.com/a/b/issues/1', assignees: [], labels: [] }, { pull_request: {}, number: 2 }]);
    if (url.pathname.endsWith('/readme')) return Response.json({ encoding: 'base64', content: Buffer.from('README').toString('base64') });
    if (url.pathname.endsWith('/community/profile')) return Response.json({ files: {} });
    return Response.json({ full_name: 'a/b', language: 'TypeScript' });
  });
  const result = await adapter.generate('recommend_issues', { owner: 'a', repo: 'b', modelSource: 'agent', userProfile: { programmingLanguages: ['typescript'] } }, async () => { throw new Error('wrong route'); });
  assert.equal(result.context.repository.fullName, 'a/b');
  assert.equal(result.context.issues.length, 1);
  assert.equal(result.request.userProfile.programmingLanguages[0], 'typescript');
  assert.equal(seen.length, 4);
});
