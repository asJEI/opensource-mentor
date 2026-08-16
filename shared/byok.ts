/**
 * BYOK transport contracts — browser localStorage → request headers → Worker (request-scoped only).
 * Never put API keys in URL query strings.
 */

export const BYOK_HEADERS = {
  aiMode: 'X-AI-Mode',
  aiProvider: 'X-AI-Provider',
  aiModel: 'X-AI-Model',
  aiBaseUrl: 'X-AI-Base-Url',
  aiKey: 'X-AI-Key',
  githubToken: 'X-User-GitHub-Token',
} as const

/** Redact secrets from any string that might be logged or returned to clients. */
export function redactSecrets(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/gh[pousr]_[A-Za-z0-9_]{10,}/g, '[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]{10,}/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"'\s,}]{8,}/gi, 'apiKey=[redacted]')
    .replace(/X-AI-Key["']?\s*[:=]\s*["']?[^"'\s,}]{8,}/gi, 'X-AI-Key=[redacted]')
}

/** Strip credential fields from objects before any logging/debug serialization. */
export function stripSecretsFromUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSecretsFromUnknown)
  }
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase()
    if (
      lower === 'apikey' ||
      lower === 'api_key' ||
      lower === 'token' ||
      lower === 'authorization' ||
      lower === 'aiproviderconfig'
    ) {
      if (lower === 'aiproviderconfig' && nested && typeof nested === 'object') {
        const cfg = { ...(nested as Record<string, unknown>) }
        if ('apiKey' in cfg) cfg.apiKey = cfg.apiKey ? '[redacted]' : undefined
        out[key] = cfg
      } else {
        out[key] = nested ? '[redacted]' : nested
      }
      continue
    }
    out[key] = stripSecretsFromUnknown(nested)
  }
  return out
}
