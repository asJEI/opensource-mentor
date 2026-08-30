import { describe, expect, it } from 'vitest'
import {
  parseGitHubIssueInput,
  parseGitHubIssueOrRepoInput,
  parseGitHubRepositoryInput,
} from './githubRepository'

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

describe('parseGitHubIssueInput', () => {
  it('parses a GitHub issue URL', () => {
    expect(
      parseGitHubIssueInput('https://github.com/microsoft/vscode/issues/123'),
    ).toEqual({
      owner: 'microsoft',
      name: 'vscode',
      number: 123,
    })
  })

  it('parses owner/repo#number and path shorthand', () => {
    expect(parseGitHubIssueInput('Hebbian-Robotics/hflow#280')).toEqual({
      owner: 'Hebbian-Robotics',
      name: 'hflow',
      number: 280,
    })
    expect(parseGitHubIssueInput('owner/repo/issues/42')).toEqual({
      owner: 'owner',
      name: 'repo',
      number: 42,
    })
  })

  it('rejects invalid issue references', () => {
    expect(parseGitHubIssueInput('https://github.com/owner/repo')).toBeNull()
    expect(parseGitHubIssueInput('owner/repo#0')).toBeNull()
    expect(parseGitHubIssueInput('owner/repo#abc')).toBeNull()
  })
})

describe('parseGitHubIssueOrRepoInput', () => {
  it('prefers issue detection over repository detection', () => {
    expect(
      parseGitHubIssueOrRepoInput(
        'https://github.com/microsoft/vscode/issues/123',
      ),
    ).toEqual({
      type: 'issue',
      owner: 'microsoft',
      name: 'vscode',
      number: 123,
    })
  })

  it('falls back to repository parsing', () => {
    expect(parseGitHubIssueOrRepoInput('microsoft/vscode')).toEqual({
      type: 'repo',
      owner: 'microsoft',
      name: 'vscode',
    })
  })
})
