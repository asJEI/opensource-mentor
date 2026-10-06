import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const userA = '00000000-0000-4000-8000-000000000001'
const userB = '00000000-0000-4000-8000-000000000002'
async function write(
  user: string,
  kind: string,
  revision: number,
  operation: string,
  content = { summary: 'test' },
  scope = 'owner/repo#1',
) {
  const rows = await db.query<{
    result: { status: string; document: { revision: number; content: unknown; context_id: string } }
  }>('select public.save_workspace_document($1,$2,$3,$4,$5,$6) as result', [
    user,
    scope,
    kind,
    JSON.stringify(content),
    revision,
    operation,
  ])
  return rows.rows[0].result
}
describe('workspace SQL migration and transactional persistence', () => {
  beforeAll(async () => {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role; create table public.app_users(id uuid primary key); insert into public.app_users values ('${userA}'),('${userB}');`,
    )
    await db.exec(
      readFileSync('supabase/migrations/20261006062317_workspace_persistence.sql', 'utf8'),
    )
  }, 30000)
  afterAll(async () => {
    await db.close()
  })
  it('creates stable context IDs and persists independent documents', async () => {
    const first = await write(userA, 'pr', 0, '10000000-0000-4000-8000-000000000001')
    const guide = await write(userA, 'guide', 0, '10000000-0000-4000-8000-000000000002')
    expect(first.document.revision).toBe(1)
    expect(guide.document.context_id).toBe(first.document.context_id)
    expect((await db.query('select * from workspace_documents')).rows).toHaveLength(2)
  })
  it('rejects stale revisions without overwriting current content', async () => {
    const stale = await write(userA, 'pr', 0, '10000000-0000-4000-8000-000000000003', {
      summary: 'stale',
    })
    expect(stale.status).toBe('conflict')
    expect(stale.document.content).toEqual({ summary: 'test' })
  })
  it('replays an uncertain successful write once, even after later edits', async () => {
    const operation = '10000000-0000-4000-8000-000000000004'
    const saved = await write(userA, 'pr', 1, operation, { summary: 'edit' })
    await write(userA, 'pr', 2, '10000000-0000-4000-8000-000000000005', { summary: 'later' })
    expect(await write(userA, 'pr', 1, operation, { summary: 'edit' })).toEqual(saved)
    const current = await db.query<{ content: unknown }>(
      'select content from workspace_documents where user_id=$1 and kind=$2',
      [userA, 'pr'],
    )
    expect(current.rows[0].content).toEqual({ summary: 'later' })
  })
  it('rejects operation-ID reuse with a different request atomically', async () => {
    await expect(write(userA, 'chat', 0, '10000000-0000-4000-8000-000000000004')).rejects.toThrow(
      /reused/,
    )
    expect(
      (await db.query("select * from workspace_documents where kind='chat'")).rows,
    ).toHaveLength(0)
  })
  it('isolates two users with identical context keys and operation IDs', async () => {
    const b = await write(userB, 'pr', 0, '10000000-0000-4000-8000-000000000001', {
      summary: 'B only',
    })
    const a = await db.query<{ id: string }>('select id from workspace_contexts where user_id=$1', [
      userA,
    ])
    expect(b.document.context_id).not.toBe(a.rows[0].id)
    await expect(
      db.query(
        'insert into workspace_documents(user_id,context_id,kind,content,revision) values($1,$2,$3,$4,1)',
        [userA, b.document.context_id, 'chat', '{}'],
      ),
    ).rejects.toThrow(/foreign key/)
  })
  it('enables RLS and forbids client table access and RPC execution', async () => {
    const result = await db.query<{ rls: boolean; read: boolean; execute: boolean }>(
      `select c.relrowsecurity as rls, has_table_privilege('anon',c.oid,'SELECT') as read, has_function_privilege('authenticated','public.save_workspace_document(uuid,text,text,jsonb,bigint,uuid)','EXECUTE') as execute from pg_class c where c.relname in ('workspace_contexts','workspace_documents','workspace_operations','workspace_review_runs')`,
    )
    expect(result.rows).toHaveLength(4)
    expect(result.rows.every((row) => row.rls && !row.read && !row.execute)).toBe(true)
    await db.exec('set role anon')
    try {
      await expect(db.query('select * from workspace_documents')).rejects.toThrow(
        /permission denied/,
      )
    } finally {
      await db.exec('reset role')
    }
  })
  it('allows only the trusted service role to save via an invoker function', async () => {
    await db.exec('set role service_role')
    try {
      expect((await write(userB, 'chat', 0, '10000000-0000-4000-8000-000000000007')).status).toBe(
        'saved',
      )
    } finally {
      await db.exec('reset role')
    }
  })
})
