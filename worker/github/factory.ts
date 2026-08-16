import { resolvePlatformConfig, type PlatformEnv } from '../config'
import { GitHubClient, resolveGitHubToken } from './client'
import { GitHubService } from './service'

export function createGitHubService(
  request: Request,
  env: PlatformEnv,
): GitHubService {
  const platform = resolvePlatformConfig(env)
  const token = resolveGitHubToken(request, platform.platformGithubToken)
  const client = new GitHubClient({
    baseUrl: platform.githubApiBaseUrl,
    token,
    timeoutMs: 15_000,
  })
  return new GitHubService(client)
}
