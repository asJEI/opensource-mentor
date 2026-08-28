import { redactSecrets } from '../../shared/byok'
import { ApiError } from '../http'
import type { PlatformEnv } from '../config'

export type AppUserRow = {
  id: string
  github_id: number
  github_username: string
  github_avatar: string
  created_at?: string
  updated_at?: string
}

export type DeveloperProfileRow = {
  id: string
  user_id?: string
  app_user_id?: string
  profile_setup_status: 'not_started' | 'completed' | 'skipped'
  profile_confirmed: boolean
  developer_profile?: unknown
  github_profile?: unknown
  open_source_goal?: string | null
  preferred_tech_stack?: string[] | null
  contribution_time_budget?: string | null
  guidance_preference?: string | null
  created_at?: string
  updated_at?: string
}

type SupabaseErrorBody = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export class SupabaseRestClient {
  private readonly restUrl: string
  private readonly secretKey: string

  constructor(env: PlatformEnv) {
    const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/u, '')
    const secretKey = env.SUPABASE_SECRET_KEY?.trim()
    if (!supabaseUrl || !secretKey) {
      throw new ApiError('Supabase 尚未配置', 503)
    }
    this.restUrl = `${supabaseUrl}/rest/v1`
    this.secretKey = secretKey
  }

  async request<T>(
    path: string,
    init: RequestInit & { prefer?: string } = {},
  ): Promise<T> {
    const response = await fetch(`${this.restUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.secretKey,
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(init.prefer ? { Prefer: init.prefer } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(12_000),
    })

    if (!response.ok) {
      let message = `Supabase request failed (${response.status})`
      try {
        const body = (await response.json()) as SupabaseErrorBody
        message = body.message || body.details || message
      } catch {
        // keep generic message
      }
      throw new ApiError(redactSecrets(message), response.status)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}

export function createSupabaseClient(env: PlatformEnv): SupabaseRestClient {
  return new SupabaseRestClient(env)
}
