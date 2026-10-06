import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceDocument, WorkspacePayloads, WorkspaceWrite } from '../../shared/workspace'
import { WorkspaceConflict } from '../services/workspaceService'
import { WorkspaceSync, type SyncState } from './workspaceSync'

const content = (summary: string): WorkspacePayloads['pr'] => ({
  prType: 'bug',
  summary,
  linkedIssue: '1',
  prDraft: null,
  currentOwner: 'owner',
  currentRepo: 'repo',
})
function setup(cache = new Map<string, string>()) {
  let remote: WorkspaceDocument | null = null
  let state: SyncState | null = null
  const applied: unknown[] = []
  const requests: WorkspaceWrite[] = []
  const successes = new Map<string, WorkspaceDocument>()
  const transport = {
    read: vi.fn(async () => (remote ? [remote] : [])),
    write: vi.fn(async (input: WorkspaceWrite) => {
      requests.push(structuredClone(input))
      const previous = successes.get(input.operationId)
      if (previous) return previous
      if (input.expectedRevision !== (remote?.revision || 0)) throw new WorkspaceConflict(remote)
      remote = {
        context_id: 'context',
        kind: input.kind,
        content: input.content,
        revision: input.expectedRevision + 1,
        updated_at: '2026-10-06T00:00:00Z',
      }
      successes.set(input.operationId, remote)
      return remote
    }),
  }
  const create = () =>
    new WorkspaceSync(
      transport,
      {
        getItem: (key) => cache.get(key) || null,
        setItem: (key, value) => {
          cache.set(key, value)
        },
      },
      (...args) => {
        applied.push(args)
      },
      (next) => {
        state = next
      },
    )
  return {
    create,
    transport,
    applied,
    requests,
    cache,
    state: () => state,
    setRemote: (value: WorkspaceDocument) => {
      remote = value
    },
  }
}
afterEach(() => {
  vi.restoreAllMocks()
})
describe('durable workspace outbox', () => {
  it('ignores a stale read arriving after a newer save', async () => {
    const s = setup(), sync = s.create()
    await sync.start('A')
    sync.update('workspace', 'pr', content('first'))
    await sync.flush()
    let release!: (documents: WorkspaceDocument[]) => void
    s.transport.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const reading = sync.load('workspace')
    sync.update('workspace', 'pr', content('newer'))
    await sync.flush()
    const count = s.applied.length
    release([{ context_id: 'context', kind: 'pr', revision: 1, content: content('stale'), updated_at: 'old' }])
    await reading
    expect(s.applied).toHaveLength(count)
    expect(s.cache.get('osm.cloud.v1:A')).toContain('newer')
    expect(s.cache.get('osm.cloud.v1:A')).not.toContain('stale')
    sync.stop()
  })
  it('coalesces typing and recovers saved data after restarting', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    sync.update('workspace', 'pr', content('first'))
    sync.update('workspace', 'pr', content('latest'))
    await sync.flush()
    expect(s.requests).toHaveLength(1)
    expect(s.requests[0].content).toMatchObject({ summary: 'latest' })
    sync.stop()
    const reopened = s.create()
    await reopened.start('A')
    expect(s.applied.at(-1)).toEqual(['workspace', 'pr', content('latest')])
    reopened.stop()
  })
  it('replays a write after its response was lost with the same operation ID', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    const save = s.transport.write.getMockImplementation()!
    s.transport.write.mockImplementationOnce(async (input) => {
      await save(input)
      throw new Error('connection lost')
    })
    sync.update('workspace', 'pr', content('saved on server'))
    await sync.flush()
    expect(s.state()?.status).toBe('error')
    sync.stop()
    const reopened = s.create()
    await reopened.start('A')
    await reopened.flush()
    expect(s.requests[1].operationId).toBe(s.requests[0].operationId)
    expect(s.requests[1].expectedRevision).toBe(0)
    expect(s.state()?.pending).toBe(0)
    reopened.stop()
  })
  it('keeps edits made while a write is in flight for the next revision', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    const save = s.transport.write.getMockImplementation()!
    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    s.transport.write.mockImplementationOnce(async (input) => {
      await wait
      return save(input)
    })
    sync.update('workspace', 'pr', content('first'))
    const flushing = sync.flush()
    sync.update('workspace', 'pr', content('second'))
    release()
    await flushing
    expect(s.requests.map((request) => request.expectedRevision)).toEqual([0, 1])
    expect(s.requests[1].content).toMatchObject({ summary: 'second' })
    sync.stop()
  })
  it('exposes conflicts without silently overwriting and explicitly rebases local content', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    s.setRemote({
      context_id: 'context',
      kind: 'pr',
      revision: 4,
      content: content('other device'),
      updated_at: 'now',
    })
    sync.update('workspace', 'pr', content('local edit'))
    await sync.flush()
    expect(s.state()?.status).toBe('conflict')
    const id = s.requests[0].operationId
    await sync.resolveConflict(true)
    expect(s.requests[1].expectedRevision).toBe(4)
    expect(s.requests[1].operationId).not.toBe(id)
    expect(s.state()?.status).toBe('saved')
    sync.stop()
  })
  it('can discard local conflict content in favor of the cloud', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    s.setRemote({
      context_id: 'context',
      kind: 'pr',
      revision: 2,
      content: content('remote'),
      updated_at: 'now',
    })
    sync.update('workspace', 'pr', content('local'))
    await sync.flush()
    await sync.resolveConflict(false)
    expect(s.applied.at(-1)).toEqual(['workspace', 'pr', content('remote')])
    expect(sync.hasPending()).toBe(false)
    sync.stop()
  })
  it('ignores a late response after switching accounts and keeps account A outbox isolated', async () => {
    const s = setup(),
      sync = s.create()
    await sync.start('A')
    let release!: (doc: WorkspaceDocument) => void
    s.transport.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    sync.update('workspace', 'pr', content('A private'))
    const flushing = sync.flush()
    await sync.start('B')
    release({
      context_id: 'a',
      kind: 'pr',
      revision: 1,
      content: content('A private'),
      updated_at: 'now',
    })
    await flushing
    expect(s.state()?.pending).toBe(0)
    expect(s.applied.some((entry) => JSON.stringify(entry).includes('A private'))).toBe(false)
    expect(s.cache.get('osm.cloud.v1:A')).toContain('A private')
    expect(s.cache.get('osm.cloud.v1:B')).not.toContain('A private')
    sync.stop()
  })
  it('does not report a failed restore as saved merely because the outbox is empty', async () => {
    const s = setup(),
      sync = s.create()
    s.transport.read.mockRejectedValue(new Error('offline'))
    await sync.start('A')
    await sync.flush()
    expect(s.state()?.status).toBe('error')
    sync.stop()
  })
})
