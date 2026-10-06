import { create } from 'zustand'
import type { SyncState } from '../sync/workspaceSync'

export const useWorkspaceStore = create<
  SyncState & {
    userId: string | null
    restoring: boolean
    legacyAvailable: boolean
    contextId: string | null
  }
>(() => ({
  status: 'local',
  error: null,
  pending: 0,
  updatedAt: null,
  durable: true,
  userId: null,
  restoring: false,
  legacyAvailable: false,
  contextId: null,
}))
