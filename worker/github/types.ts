export interface RepositoryDto {
  id: number
  name: string
  fullName: string
  owner: string
  ownerAvatar: string
  description: string | null
  stars: number
  forks: number
  watchers: number
  openIssues: number
  language: string | null
  topics: string[]
  license: string | null
  homepage: string | null
  defaultBranch: string
  createdAt: string
  updatedAt: string
  size: number
  htmlUrl: string
}

export interface IssueLabelDto {
  id: number
  name: string
  color: string
  description: string | null
}

export interface IssueDto {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  author: string
  authorAvatar: string
  labels: IssueLabelDto[]
  comments: number
  createdAt: string
  updatedAt: string
  htmlUrl: string
}

export interface IssueListParams {
  state?: 'open' | 'closed' | 'all'
  labels?: string
  sort?: 'created' | 'updated' | 'comments'
  direction?: 'asc' | 'desc'
  page?: number
  perPage?: number
}
