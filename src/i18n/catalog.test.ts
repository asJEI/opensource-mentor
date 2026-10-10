import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import catalog from './en-US.json'
import generated from '../../shared/generated.en-US.json'

describe('translation catalogs', () => {
  it('covers every literal frontend translation key', () => {
    const missing: string[] = []
    function walk(directory: string) {
      for (const file of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, file.name)
        if (file.isDirectory()) { walk(path); continue }
        if (!/\.tsx?$/.test(file.name) || file.name.includes('.test.')) continue
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && node.expression.getText(source) === 't'
            && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const key = node.arguments[0].text
            if (!Object.hasOwn(catalog, key)) missing.push(`${path}: ${key}`)
          }
          ts.forEachChild(node, visit)
        }
        visit(source)
      }
    }
    walk(join(process.cwd(), 'src'))
    expect(missing).toEqual([])
  })
  it('preserves every placeholder in the backend fallback catalog', () => {
    for (const [key, value] of Object.entries(generated)) {
      const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((item) => item[0]).sort()
      expect(placeholders(value), key).toEqual(placeholders(key))
    }
  })
})
