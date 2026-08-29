/** Shared JSON / validation helpers for AI response parsing. */

export function parseJsonSafely(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>
      } catch {
        // ignore
      }
    }
    return {}
  }
}

export function ensureStringArray(
  value: unknown,
  fallback: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((v) => {
        if (typeof v === 'string') return v.trim()
        if (v && typeof v === 'object') {
          const record = v as Record<string, unknown>
          for (const key of ['text', 'content', 'item', 'point', 'step', 'title']) {
            if (typeof record[key] === 'string' && record[key].trim()) {
              return String(record[key]).trim()
            }
          }
        }
        return ''
      })
      .filter(Boolean)
    return items.length > 0 ? items : fallback
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
      .filter(Boolean)
  }
  return fallback
}

export function ensureEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  fallback: T,
): T {
  const str = String(value)
  return (validValues as readonly string[]).includes(str)
    ? (str as T)
    : fallback
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
