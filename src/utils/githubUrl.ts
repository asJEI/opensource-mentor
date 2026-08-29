/** Build GitHub blob / tree URLs for repository paths. */

export function buildGithubBlobUrl(params: {
  owner: string
  repo: string
  path: string
  branch?: string
}): string {
  const branch = params.branch?.trim() || 'main'
  const path = params.path.replace(/^\/+/, '')
  return `https://github.com/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/blob/${encodeURIComponent(branch)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

export function buildGithubTreeUrl(params: {
  owner: string
  repo: string
  path: string
  branch?: string
}): string {
  const branch = params.branch?.trim() || 'main'
  const path = params.path.replace(/^\/+/, '')
  return `https://github.com/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/tree/${encodeURIComponent(branch)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}
