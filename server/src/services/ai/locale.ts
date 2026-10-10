import { generatedText } from '../../../../shared/generatedLocale'
import { getRequestLocale } from '../../middlewares/localeContext'

export function t(key: string, values: readonly unknown[] = []): string {
  const template = generatedText(key, getRequestLocale())
  return template.replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : match)
}
