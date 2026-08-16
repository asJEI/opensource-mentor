export interface ParsedGitHubRepository {
  owner: string
  name: string
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])

function cleanRepositoryName(value: string): string {
  return value.replace(/\.git$/i, '')
}

function isValidRepositoryPart(value: string): boolean {
  return value.length > 0 && !value.startsWith('.') && !value.endsWith('.')
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
