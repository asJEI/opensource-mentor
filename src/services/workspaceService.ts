import { t } from '@/i18n'
import type { WorkspaceDocument, WorkspaceSaveResult, WorkspaceWrite } from '@shared/workspace'

export class WorkspaceConflict extends Error {
  readonly remote: WorkspaceDocument | null
  constructor(remote: WorkspaceDocument | null) {
    super(t("此内容已在其他页面更新"))
    this.remote = remote
  }
}
export const workspaceService = {
  async read(scope: string): Promise<WorkspaceDocument[]> {
    const response = await fetch(`/api/workspace?scope=${encodeURIComponent(scope)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const body = await response.json()
    if (!response.ok || !body.success) throw new Error(body.message || t("无法恢复云端进度"))
    return body.data.documents
  },
  async write(input: WorkspaceWrite): Promise<WorkspaceDocument> {
    const response = await fetch('/api/workspace', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = await response.json()
    const result = body.data as WorkspaceSaveResult | undefined
    if (response.status === 409) throw new WorkspaceConflict(result?.document || null)
    if (!response.ok || !body.success || !result?.document)
      throw new Error(body.message || t("保存进度失败"))
    return result.document
  },
}
