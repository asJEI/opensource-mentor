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
    return value.filter((v): v is string => typeof v === 'string')
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
