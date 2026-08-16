import type { AxiosInstance } from 'axios'

export type AIRuntime = {
  client: AxiosInstance | null
  model: string
  isCustom: boolean
}

export type ReviewPrParams = {
  prUrl: string
  prTitle: string
  prBody: string
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    changes: number
    patch: string
  }>
  diff: string
  repoLanguage?: string
  repoFullName?: string
}
