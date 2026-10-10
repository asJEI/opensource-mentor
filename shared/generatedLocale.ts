import english from './generated.en-US.json'
import type { Locale } from './locale'

const catalog: Record<string, string> = english
const patterns = Object.entries(catalog).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => ({
  pattern: new RegExp('^' + key.split(/\{\d+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\s\\S]*?)') + '$'),
  value,
}))

/** Translate only application-authored fallback text. Unknown AI or GitHub text stays untouched. */
export function generatedText(text: string, locale: Locale): string {
  if (locale === 'zh-CN') return text
  if (catalog[text]) return catalog[text]
  for (const { pattern, value } of patterns) {
    const match = pattern.exec(text)
    if (match) return value.replace(/\{(\d+)\}/g, (_, index: string) => match[Number(index) + 1] ?? '')
  }
  return text
}

const technicalKeys = new Set(['name', 'filename', 'file', 'affectedFiles', 'code', 'codeSnippet',
  'yourCode', 'suggestionCode', 'commands', 'command', 'path', 'repoFullName', 'prTitle', 'prBody'])

/** Use only on generated result objects, never on repository metadata or raw Issue objects. */
export function localizeGenerated<T>(result: T, locale: Locale): T {
  if (locale === 'zh-CN') return result
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return generatedText(value, locale)
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, technicalKeys.has(key) ? item : walk(item)]))
    return value
  }
  return walk(result) as T
}
