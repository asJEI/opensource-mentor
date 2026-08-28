import { describe, expect, it } from 'vitest'
import { parseGitHubRepositoryInput } from './githubRepository'

describe('parseGitHubRepositoryInput', () => {
  it('parses owner/repo shorthand', () => {
    expect(parseGitHubRepositoryInput('microsoft/vscode')).toEqual({
      owner: 'microsoft',
      name: 'vscode',
    })
  })

  it('parses a GitHub repository URL', () => {
    expect(
      parseGitHubRepositoryInput(
        'https://github.com/DayuanJiang/next-ai-draw-io',
      ),
    ).toEqual({
      owner: 'DayuanJiang',
      name: 'next-ai-draw-io',
    })
  })

  it('ignores deeper GitHub URL paths after the repository name', () => {
    expect(
      parseGitHubRepositoryInput(
        'https://github.com/microsoft/vscode/tree/main/src',
      ),
    ).toEqual({
      owner: 'microsoft',
      name: 'vscode',
    })
  })

  it('accepts trailing slashes and .git suffixes', () => {
    expect(
      parseGitHubRepositoryInput('https://github.com/vuejs/core.git/'),
    ).toEqual({
      owner: 'vuejs',
      name: 'core',
    })
  })

  it('rejects non-GitHub URLs and malformed shorthand', () => {
    expect(parseGitHubRepositoryInput('https://example.com/a/b')).toBeNull()
    expect(parseGitHubRepositoryInput('microsoft')).toBeNull()
    expect(parseGitHubRepositoryInput('microsoft/vscode/issues')).toBeNull()
  })
})
