/**
 * Lightweight unified diff parser for the review workspace.
 */

import type { DiffHunk, DiffLine, ReviewJobArtifacts } from '@/types'

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

export function parseUnifiedDiff(
  _filename: string,
  patch: string | null,
): DiffHunk[] {
  if (!patch || patch.trim().length === 0) {
    return []
  }

  const lines = patch.split(/\r?\n/)
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const rawLine of lines) {
    const hunkMatch = HUNK_HEADER.exec(rawLine)
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk)
      }

      const oldStart = Number.parseInt(hunkMatch[1] ?? '0', 10)
      const oldLines = Number.parseInt(hunkMatch[2] ?? '1', 10)
      const newStart = Number.parseInt(hunkMatch[3] ?? '0', 10)
      const newLines = Number.parseInt(hunkMatch[4] ?? '1', 10)

      oldLine = oldStart
      newLine = newStart

      currentHunk = {
        header: rawLine,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      }
      continue
    }

    if (
      !currentHunk ||
      rawLine.startsWith('diff ') ||
      rawLine.startsWith('index ') ||
      rawLine.startsWith('---') ||
      rawLine.startsWith('+++')
    ) {
      continue
    }

    if (rawLine.startsWith('\\')) {
      continue
    }

    const prefix = rawLine[0] ?? ' '
    const content = rawLine.slice(1)
    let diffLine: DiffLine

    if (prefix === '+') {
      diffLine = { type: 'added', content, newLineNumber: newLine }
      newLine += 1
    } else if (prefix === '-') {
      diffLine = { type: 'removed', content, oldLineNumber: oldLine }
      oldLine += 1
    } else {
      diffLine = {
        type: 'context',
        content,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      }
      oldLine += 1
      newLine += 1
    }

    currentHunk.lines.push(diffLine)
  }

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  return hunks
}

export function findFilePatch(
  artifacts: ReviewJobArtifacts | undefined,
  filename: string,
): string | null {
  if (!artifacts) return null
  const file = artifacts.changedFiles.find(
    (entry) => entry.filename === filename,
  )
  return file?.patch ?? null
}
