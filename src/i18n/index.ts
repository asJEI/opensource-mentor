import { useUserStore } from '@/store/user'
import messages from './en-US.json'
import type { Locale } from '@shared/locale'

/** Chinese source text is the stable catalog key; dynamic values are never translated. */
export function translate(key: string, locale: Locale, values: readonly unknown[] = []): string {
  const template = locale === 'en-US' ? (messages as Record<string, string>)[key] ?? key : key
  return template.replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : match)
}

/** Also usable from stores, async callbacks and services, outside React. */
export function t(key: string, values: readonly unknown[] = []): string {
  return translate(key, useUserStore.getState().preferences.language, values)
}

const reverse = new Map(Object.entries(messages).map(([key, value]) => [value, key]))
const storedTemplates = Object.entries(messages).flatMap(([key, value]) => {
  if (!/\{\d+\}/.test(key)) return []
  return [key, value].filter((template) => template.replace(/\{\d+\}/g, '').trim().length > 0).map((template) => ({
    key,
    indices: [...template.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1])),
    pattern: new RegExp('^' + template.split(/\{\d+\}/).map((part) =>
      part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\s\\S]*?)') + '$'),
  }))
})

/** Transient UI messages may already be rendered in the previous locale. */
export function uiMessage(text: string): string {
  if (Object.hasOwn(messages, text)) return t(text)
  const key = reverse.get(text)
  if (key) return t(key)
  for (const template of storedTemplates) {
    const match = template.pattern.exec(text)
    if (!match) continue
    const values: string[] = []
    template.indices.forEach((index, position) => { values[index] = match[position + 1] ?? '' })
    return t(template.key, values)
  }
  return text
}
