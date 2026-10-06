import {
  isWorkspaceScope,
  MAX_WORKSPACE_BYTES,
  parseWorkspaceWrite,
  type WorkspaceDocument,
  type WorkspaceSaveResult,
} from '../../shared/workspace'
import { readSession } from '../auth/session'
import { readCurrentUser } from '../auth/userPersistence'
import type { PlatformEnv } from '../config'
import { ApiError, json, success } from '../http'
import { createSupabaseClient } from '../supabase/client'

async function userId(request: Request, env: PlatformEnv): Promise<string> {
  const session = await readSession(request, env)
  if (!session) throw new ApiError('请先登录后同步进度', 401, { errorCode: 'AUTH_REQUIRED' })
  const user = await readCurrentUser(env, session.githubId)
  if (!user || user.appUser.id !== session.userId)
    throw new ApiError('登录状态已失效', 401, { errorCode: 'AUTH_REQUIRED' })
  return session.userId
}
export async function handleGetWorkspace(request: Request, env: PlatformEnv): Promise<Response> {
  const id = await userId(request, env)
  const scope = new URL(request.url).searchParams.get('scope') || 'workspace'
  if (!isWorkspaceScope(scope))
    throw new ApiError('工作区标识不正确', 400, { errorCode: 'VALIDATION_ERROR' })
  const db = createSupabaseClient(env)
  const contexts = await db.request<Array<{ id: string }>>(
    `/workspace_contexts?user_id=eq.${id}&context_key=eq.${encodeURIComponent(scope)}&select=id&limit=1`,
  )
  const documents = contexts.length
    ? await db.request<WorkspaceDocument[]>(
        `/workspace_documents?user_id=eq.${id}&context_id=eq.${contexts[0].id}&select=context_id,kind,content,revision,updated_at`,
      )
    : []
  const response = success({ contextId: contexts[0]?.id || null, documents })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export async function handleSaveWorkspace(request: Request, env: PlatformEnv): Promise<Response> {
  const origin = request.headers.get('Origin')
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    throw new ApiError('请从本站保存进度', 403)
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
    throw new ApiError('请求必须使用 JSON', 415)
  const id = await userId(request, env)
  // Read a bounded stream rather than trusting Content-Length.
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('请求内容不能为空', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_WORKSPACE_BYTES) {
      await reader.cancel()
      throw new ApiError('保存内容过大', 413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  let input
  try {
    input = parseWorkspaceWrite(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    throw new ApiError('工作区内容、类型或版本不正确', 400, { errorCode: 'VALIDATION_ERROR' })
  }
  const result = await createSupabaseClient(env).request<WorkspaceSaveResult>(
    '/rpc/save_workspace_document',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: id,
        p_scope: input.scope,
        p_kind: input.kind,
        p_content: input.content,
        p_expected_revision: input.expectedRevision,
        p_operation_id: input.operationId,
      }),
    },
  )
  const response =
    result.status === 'conflict'
      ? json(
          {
            success: false,
            data: result,
            message: '其他页面已更新此内容，请处理版本冲突',
            code: 409,
            errorCode: 'WORKSPACE_CONFLICT',
          },
          409,
        )
      : success(result)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
