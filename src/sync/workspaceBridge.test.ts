import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { WorkspaceDocument, WorkspaceWrite } from '../../shared/workspace'

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('../services/workspaceService', async (original) => ({
  ...(await original<object>()),
  workspaceService: mocks,
}))
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, value: string) => {
    storage.set(key, value)
  },
  removeItem: (key: string) => {
    storage.delete(key)
  },
})
vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} })
vi.stubGlobal('window', new EventTarget())

describe('Web stores cloud restore and task isolation', () => {
  let bridge: typeof import('./workspaceBridge')
  let user: typeof import('../store/user')
  let repo: typeof import('../store/repository')
  let pr: typeof import('../store/pr')
  let workspace: typeof import('../store/workspace')
  let dispose: () => void
  const documents = new Map<string, WorkspaceDocument>()
  beforeAll(async () => {
    user = await import('../store/user')
    repo = await import('../store/repository')
    pr = await import('../store/pr')
    workspace = await import('../store/workspace')
    bridge = await import('./workspaceBridge')
    mocks.read.mockImplementation(async (scope: string) =>
      [...documents.entries()]
        .filter(([key]) => key.startsWith(`${user.useUserStore.getState().serverUserId}:${scope}:`))
        .map(([, doc]) => doc),
    )
    mocks.write.mockImplementation(async (input: WorkspaceWrite) => {
      const key = `${user.useUserStore.getState().serverUserId}:${input.scope}:${input.kind}`
      const doc = {
        context_id: input.scope,
        kind: input.kind,
        content: input.content,
        revision: input.expectedRevision + 1,
        updated_at: 'now',
      }
      documents.set(key, doc)
      return doc
    })
    dispose = bridge.initializeWorkspaceSync()
  })
  afterAll(() => {
    dispose()
    vi.unstubAllGlobals()
  })
  const ready = async () => {
    await vi.waitFor(() => expect(workspace.useWorkspaceStore.getState().restoring).toBe(false))
  }
  it('restores account A selection and PR draft without uploading anonymous data', async () => {
    repo.useRepositoryStore.setState({ currentOwner: 'legacy', currentRepoName: 'unknown' })
    documents.set('A:workspace:selection', {
      context_id: 'workspace',
      kind: 'selection',
      content: { currentOwner: 'owner', currentRepoName: 'repo', activeContributionIssue: null },
      revision: 1,
      updated_at: 'now',
    })
    documents.set('A:owner/repo#0:pr', {
      context_id: 'a-task',
      kind: 'pr',
      content: {
        prType: 'bug',
        summary: 'A cloud draft',
        linkedIssue: '',
        prDraft: null,
        currentOwner: 'owner',
        currentRepo: 'repo',
      },
      revision: 2,
      updated_at: 'now',
    })
    user.useUserStore.setState({ isAuthenticated: true, serverUserId: 'A' })
    await ready()
    expect(repo.useRepositoryStore.getState().currentOwner).toBe('owner')
    expect(pr.usePrStore.getState().summary).toBe('A cloud draft')
    expect(workspace.useWorkspaceStore.getState().contextId).toBe('a-task')
    expect(mocks.write).not.toHaveBeenCalled()
    expect(workspace.useWorkspaceStore.getState().legacyAvailable).toBe(true)
  })
  it('saves edits in the selected task and restores a different task separately', async () => {
    pr.usePrStore.getState().setSummary('saved A edit')
    await bridge.workspaceSync.flush()
    expect(documents.get('A:owner/repo#0:pr')?.content).toMatchObject({ summary: 'saved A edit' })
    repo.useRepositoryStore.setState({ currentOwner: 'owner', currentRepoName: 'other' })
    await ready()
    expect(pr.usePrStore.getState().summary).toBe('')
    pr.usePrStore.getState().setSummary('other task')
    await bridge.workspaceSync.flush()
    repo.useRepositoryStore.setState({ currentOwner: 'owner', currentRepoName: 'repo' })
    await ready()
    expect(pr.usePrStore.getState().summary).toBe('saved A edit')
  })
  it('clears A data before showing a second account and never reuses A task data', async () => {
    user.useUserStore.setState({ isAuthenticated: true, serverUserId: 'B' })
    await ready()
    expect(repo.useRepositoryStore.getState().currentOwner).toBe('')
    expect(pr.usePrStore.getState().summary).toBe('')
    expect(bridge.workspaceSync.hasPending()).toBe(false)
    expect(storage.get('osm.cloud.v1:A')).toContain('saved A edit')
    expect(storage.get('osm.cloud.v1:B')).not.toContain('saved A edit')
  })
})
