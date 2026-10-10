import { t } from '@/i18n'
import {
  validWorkspaceContent,
  isWorkspaceScope,
  type WorkspaceDocument,
  type WorkspaceKind,
  type WorkspacePayloads,
  type WorkspaceWrite,
} from '../../shared/workspace'
import { WorkspaceConflict } from '../services/workspaceService'

type Pending = {
  kind: WorkspaceKind
  scope: string
  content: WorkspacePayloads[WorkspaceKind]
  operationId: string
  expectedRevision: number | null
}
type Cached = { documents: Record<string, WorkspaceDocument>; queue: Pending[] }
export type SyncStatus = 'local' | 'loading' | 'saved' | 'saving' | 'error' | 'conflict'
export type SyncState = {
  status: SyncStatus
  error: string | null
  pending: number
  updatedAt: string | null
  durable: boolean
}
type Transport = {
  read(scope: string): Promise<WorkspaceDocument[]>
  write(input: WorkspaceWrite): Promise<WorkspaceDocument>
}
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }
const keyOf = (scope: string, kind: WorkspaceKind) => `${scope}:${kind}`

/** Per-account durable outbox; retries keep their original operation ID and revision. */
export class WorkspaceSync {
  private user: string | null = null
  private generation = 0
  private documents: Record<string, WorkspaceDocument> = {}
  private queue: Pending[] = []
  private running = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private conflict: { pending: Pending; remote: WorkspaceDocument | null } | null = null
  private cacheFailed = false
  private state: SyncState = {
    status: 'local',
    error: null,
    pending: 0,
    updatedAt: null,
    durable: true,
  }
  private transport: Transport
  private storage: Storage
  private apply: (
    scope: string,
    kind: WorkspaceKind,
    content: WorkspacePayloads[WorkspaceKind],
  ) => void
  private notify: (state: SyncState) => void
  constructor(
    transport: Transport,
    storage: Storage,
    apply: (scope: string, kind: WorkspaceKind, content: WorkspacePayloads[WorkspaceKind]) => void,
    notify: (state: SyncState) => void,
  ) {
    this.transport = transport
    this.storage = storage
    this.apply = apply
    this.notify = notify
  }
  private report(status: SyncStatus, error: string | null = null) {
    this.state = {
      ...this.state,
      status,
      error,
      pending: this.queue.length,
      durable: !this.cacheFailed,
    }
    this.notify(this.state)
  }
  private persist() {
    if (!this.user) return
    try {
      this.storage.setItem(
        `osm.cloud.v1:${this.user}`,
        JSON.stringify({ documents: this.documents, queue: this.queue } satisfies Cached),
      )
      this.cacheFailed = false
    } catch {
      this.cacheFailed = true
    }
  }
  stop() {
    this.generation++
    clearTimeout(this.timer)
    this.user = null
    this.running = false
    this.documents = {}
    this.queue = []
    this.conflict = null
    this.cacheFailed = false
    this.state = { status: 'local', error: null, pending: 0, updatedAt: null, durable: true }
    this.report('local')
  }
  async start(user: string) {
    this.stop()
    this.user = user
    const generation = this.generation
    try {
      const raw = this.storage.getItem(`osm.cloud.v1:${user}`)
      if (raw) {
        const cache = JSON.parse(raw) as Cached
        // Validate cached data before allowing it to touch stores or enter the outbox.
        for (const [key, doc] of Object.entries(cache.documents || {})) {
          if (
            Number.isSafeInteger(doc.revision) &&
            doc.revision > 0 &&
            validWorkspaceContent(doc.kind, doc.content)
          )
            this.documents[key] = doc
        }
        this.queue = (cache.queue || []).filter(
          (item) =>
            isWorkspaceScope(item.scope) &&
            validWorkspaceContent(item.kind, item.content) &&
            typeof item.operationId === 'string' &&
            (item.expectedRevision === null || Number.isSafeInteger(item.expectedRevision)),
        )
      }
    } catch {
      this.cacheFailed = true
    }
    this.report('loading')
    await this.load('workspace')
    return generation === this.generation
  }
  async load(scope: string): Promise<boolean> {
    if (!this.user) return false
    const generation = this.generation
    this.report('loading')
    // Offline cache is useful, but never implies that pending work reached the server.
    for (const kind of [
      'selection',
      'repository',
      'guide',
      'chat',
      'pr',
      'review',
    ] as WorkspaceKind[]) {
      const cached = this.documents[keyOf(scope, kind)]
      if (cached) this.apply(scope, kind, cached.content)
      const pending = this.queue.filter((item) => item.scope === scope && item.kind === kind).at(-1)
      if (pending) this.apply(scope, kind, pending.content)
    }
    try {
      const remote = await this.transport.read(scope)
      if (generation !== this.generation) return false
      for (const doc of remote) {
        if (!validWorkspaceContent(doc.kind, doc.content))
          throw new Error(t("云端进度格式不兼容，请联系维护者"))
        const key = keyOf(scope, doc.kind)
        // A read started before a local commit may arrive after that commit.
        if ((this.documents[key]?.revision || 0) > doc.revision) continue
        this.documents[key] = doc
        if (!this.queue.some((item) => keyOf(item.scope, item.kind) === key))
          this.apply(scope, doc.kind, doc.content)
      }
      this.persist()
      this.report(this.queue.length ? 'saving' : 'saved')
      return true
    } catch (error) {
      if (generation === this.generation)
        this.report('error', error instanceof Error ? error.message : t("无法恢复进度"))
      return false
    }
  }
  update<K extends WorkspaceKind>(scope: string, kind: K, content: WorkspacePayloads[K]) {
    if (!this.user) return
    const clean = JSON.parse(JSON.stringify(content)) as WorkspacePayloads[K]
    if (!validWorkspaceContent(kind, clean)) {
      this.report('error', t("进度内容不完整，尚未保存"))
      return
    }
    const key = keyOf(scope, kind)
    const latest = this.queue.filter((item) => keyOf(item.scope, item.kind) === key).at(-1)
    if (JSON.stringify(latest?.content ?? this.documents[key]?.content) === JSON.stringify(clean))
      return
    // Coalesce only a write which has never been sent. An uncertain request must be replayed unchanged.
    if (latest && latest.expectedRevision === null) latest.content = clean
    else
      this.queue.push({
        scope,
        kind,
        content: clean,
        operationId: crypto.randomUUID(),
        expectedRevision: null,
      })
    this.persist()
    this.report(
      this.conflict ? 'conflict' : 'saving',
      this.conflict ? t("其他页面已更新，请选择保留哪一份内容") : null,
    )
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.flush()
    }, 500)
  }
  async flush() {
    if (!this.user || this.running || this.conflict || !this.queue.length) return
    clearTimeout(this.timer)
    const generation = this.generation
    this.running = true
    try {
      while (this.queue.length && generation === this.generation) {
        const pending = this.queue[0]
        const key = keyOf(pending.scope, pending.kind)
        if (pending.expectedRevision === null)
          pending.expectedRevision = this.documents[key]?.revision || 0
        this.persist()
        this.report('saving')
        const result = await this.transport.write({
          ...pending,
          expectedRevision: pending.expectedRevision,
        })
        if (generation !== this.generation) return
        this.documents[key] = result
        this.queue.shift()
        this.state.updatedAt = result.updated_at
        this.persist()
      }
      if (generation === this.generation) this.report('saved')
    } catch (error) {
      if (generation !== this.generation) return
      if (error instanceof WorkspaceConflict) {
        this.conflict = { pending: this.queue[0], remote: error.remote }
        this.report('conflict', t("其他页面已更新，请选择保留哪一份内容"))
      } else this.report('error', error instanceof Error ? error.message : t("保存失败，请重试"))
    } finally {
      if (generation === this.generation) this.running = false
    }
  }
  async resolveConflict(useLocal: boolean) {
    if (!this.conflict) return
    const { pending, remote } = this.conflict
    const key = keyOf(pending.scope, pending.kind)
    if (remote) this.documents[key] = remote
    else delete this.documents[key]
    const writes = this.queue.filter((item) => keyOf(item.scope, item.kind) === key)
    this.queue = this.queue.filter((item) => keyOf(item.scope, item.kind) !== key)
    if (useLocal) {
      const latest = writes.at(-1) || pending
      this.queue.unshift({
        ...latest,
        operationId: crypto.randomUUID(),
        expectedRevision: remote?.revision || 0,
      })
    } else if (remote) this.apply(pending.scope, pending.kind, remote.content)
    this.conflict = null
    this.persist()
    await this.flush()
  }
  hasPending() {
    return this.queue.length > 0
  }
  getConflict() {
    if (!this.conflict) return null
    const pending = this.conflict.pending
    const local =
      this.queue.filter((item) => item.scope === pending.scope && item.kind === pending.kind).at(-1)
        ?.content || pending.content
    return {
      scope: pending.scope,
      kind: pending.kind,
      local,
      remote: this.conflict.remote?.content || null,
    }
  }
  contextId(scope: string): string | null {
    return (
      Object.entries(this.documents).find(([key]) => key.startsWith(`${scope}:`))?.[1].context_id ||
      null
    )
  }
}
