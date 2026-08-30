export interface ParsedGitHubRepository {
  owner: string
  name: string
}

export interface ParsedGitHubIssue extends ParsedGitHubRepository {
  number: number
}

export type ParsedGitHubIssueOrRepo =
  | { type: 'issue'; owner: string; name: string; number: number }
  | { type: 'repo'; owner: string; name: string }

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])

function cleanRepositoryName(value: string): string {
  return value.replace(/\.git$/i, '')
}

function isValidRepositoryPart(value: string): boolean {
  return value.length > 0 && !value.startsWith('.') && !value.endsWith('.')
}

function parseIssueNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) return null
  return number
}

/**
 * Parse a GitHub issue URL or shorthand into owner/repo/number.
 * Accepts:
 * - https://github.com/owner/repo/issues/123
 * - owner/repo#123
 * - owner/repo/issues/123
 */
export function parseGitHubIssueInput(input: string): ParsedGitHubIssue | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const hashMatch = trimmed.match(/^([^/\s#]+)\/([^/\s#]+)\s*#(\d+)\s*$/)
  if (hashMatch) {
    const owner = hashMatch[1]
    const name = cleanRepositoryName(hashMatch[2])
    const number = parseIssueNumber(hashMatch[3])
    if (
      number &&
      isValidRepositoryPart(owner) &&
      isValidRepositoryPart(name)
    ) {
      return { owner, name, number }
    }
    return null
  }

  const pathMatch = trimmed.match(
    /^([^/\s]+)\/([^/\s]+)\/issues\/(\d+)\/?$/i,
  )
  if (pathMatch) {
    const owner = pathMatch[1]
    const name = cleanRepositoryName(pathMatch[2])
    const number = parseIssueNumber(pathMatch[3])
    if (
      number &&
      isValidRepositoryPart(owner) &&
      isValidRepositoryPart(name)
    ) {
      return { owner, name, number }
    }
    return null
  }

  const normalized = trimmed.match(/^https?:\/\//i)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(normalized)
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length < 4) return null
    if (segments[2]?.toLowerCase() !== 'issues') return null

    const owner = segments[0]
    const name = cleanRepositoryName(segments[1] || '')
    const number = parseIssueNumber(segments[3] || '')
    if (
      !number ||
      !isValidRepositoryPart(owner || '') ||
      !isValidRepositoryPart(name)
    ) {
      return null
    }

    return { owner, name, number }
  } catch {
    return null
  }
}

/**
 * Detect whether the user pasted an issue link or a repository link/shorthand.
 * Issue forms are checked first so `/issues/123` is not treated as a bare repo.
 */
export function parseGitHubIssueOrRepoInput(
  input: string,
): ParsedGitHubIssueOrRepo | null {
  const issue = parseGitHubIssueInput(input)
  if (issue) {
    return { type: 'issue', ...issue }
  }

  const repo = parseGitHubRepositoryInput(input)
  if (repo) {
    return { type: 'repo', ...repo }
  }

  return null
}

export function parseGitHubRepositoryInput(
  input: string,
): ParsedGitHubRepository | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const normalized = trimmed.match(/^https?:\/\//i)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(normalized)

    if (GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
      const [owner, rawName] = url.pathname
        .split('/')
        .filter(Boolean)
        .slice(0, 2)
      const name = rawName ? cleanRepositoryName(rawName) : ''

      if (isValidRepositoryPart(owner || '') && isValidRepositoryPart(name)) {
        return { owner, name }
      }
      return null
    }
  } catch {
    // Fall back to owner/repo parsing below.
  }

  const match = trimmed.match(/^([^/\s]+)\/([^/\s]+?)\/?$/)
  if (!match) return null

  const owner = match[1]
  const name = cleanRepositoryName(match[2])

  if (!isValidRepositoryPart(owner) || !isValidRepositoryPart(name)) {
    return null
  }

  return { owner, name }
}
